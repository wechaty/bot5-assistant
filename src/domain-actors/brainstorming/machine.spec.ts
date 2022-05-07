#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/**
 *   Wechaty Open Source Software - https://github.com/wechaty
 *
 *   @copyright 2022 Huan LI (李卓桓) <https://github.com/huan>, and
 *                   Wechaty Contributors <https://github.com/wechaty>.
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 *
 */
/* eslint-disable sort-keys */

import {
  AnyEventObject,
  interpret,
  createMachine,
  EventObject,
  StateValue,
}                             from 'xstate'
import { map }                from 'rxjs/operators'
import { test, sinon }        from 'tstest'
import * as CQRS              from 'wechaty-cqrs'
import { inspect }            from '@xstate/inspect/lib/server.js'
import { WebSocketServer }    from 'ws'
import * as Mailbox           from 'mailbox'

import { FileToText }                 from '../../infrastructure-actors/mod.js'
import * as WechatyActor              from '../../wechaty-actor/mod.js'
import { skipSelfMessagePayload$ }    from '../../wechaty-actor/cqrs/skip-self-message-payload$.js'
import { bot5Fixtures }               from '../../fixtures/bot5-fixture.js'

import * as Notice    from '../notice/mod.js'

import duckula, { Context }   from './duckula.js'
import machine                from './machine.js'

test('Brainstorming actor smoke testing', async t => {
  for await (
    const {
      mocker: mockerFixture,
      wechaty: wechatyFixture,
    } of bot5Fixtures()
  ) {
    const sandbox = sinon.createSandbox({
      useFakeTimers: { now: Date.now() },
    })

    const bus$ = CQRS.from(wechatyFixture.wechaty)
    const wechatyActor = WechatyActor.from(bus$, wechatyFixture.wechaty.puppet.id)

    const noticeMailbox = Mailbox.from(Notice.machine.withContext({
      ...Notice.initialContext(),
      conversation: wechatyFixture.groupRoom.id,
      actors: {
        wechaty: String(wechatyActor.address),
      },
    }))
    noticeMailbox.open()

    const server = new WebSocketServer({
      port: 8888,
    })

    inspect({ server })

    const [ [ _FILE, TEXT ] ] = await FileToText.FIXTURES()

    const FEEDBACKS = {
      [mockerFixture.mary.id]:    [ 'im mary',  'im mary' ],
      [mockerFixture.mike.id]:    [ 'im mike',  'im mike' ],
      [mockerFixture.player.id]:  [ TEXT,       TEXT ],
    } as const

    const CONTACTS = {
      [mockerFixture.mary.id]: mockerFixture.mary.payload,
      [mockerFixture.mike.id]: mockerFixture.mike.payload,
      [mockerFixture.player.id]: mockerFixture.player.payload,
    } as const

    const mailbox = Mailbox.from(machine.withContext({
      ...duckula.initialContext(),
      room: mockerFixture.groupRoom.payload,
      contacts: CONTACTS,
      chairs: {},
      actors: {
        wechaty  : String(wechatyActor.address),
        notice : String(noticeMailbox.address),
      },
    }))
    mailbox.open()

    const actorInterpreter = (mailbox as Mailbox.impls.Mailbox).internal.actor.interpreter!
    const actorSnapshot  = () => actorInterpreter.getSnapshot()
    const actorContext   = () => actorSnapshot().context as Context
    const actorState     = () => actorSnapshot().value

    const actorEventList: EventObject[] = []
    const actorStateList: StateValue[] = []
    actorInterpreter.subscribe(s => {
      actorEventList.push(s.event)
      actorStateList.push(s.value)

      console.info(`>>> ${s.machine?.id}:`, [
        `(${s.history?.value || ''})`.padEnd(30, ' '),
        ' + ',
        `[${s.event.type}]`.padEnd(30, ' '),
        ' = ',
        `(${s.value})`.padEnd(30, ' '),
      ].join(''))
    })

    const TEST_ID = 'TestMachine'
    const testMachine = createMachine<any>({
      id: TEST_ID,
      on: {
        '*': {
          actions: Mailbox.actions.proxy(TEST_ID)(mailbox),
        },
      },
    })

    const testEventList: AnyEventObject[] = []
    const testInterpreter = interpret(testMachine)
      .onEvent(e => {
        testEventList.push(e)
        console.info('<<<', testMachine.id, ':', `[${e.type}]`)
      })
      .start()

    const messageEventList: ReturnType<typeof duckula.Event.MESSAGE>[] = []

    skipSelfMessagePayload$(bus$)(wechatyFixture.wechaty.puppet.id).pipe(
      map(messagePayload => duckula.Event.MESSAGE(messagePayload)),
    ).subscribe(e => {
      console.info('### duckula.Event.MESSAGE', e)
      messageEventList.push(e)
      testInterpreter.send(e)
    })

    /**
     * XState Issue #2931 - https://github.com/statelyai/xstate/issues/2931
     *  "An unexpected error has occurred" with statecharts.io/inspect #2931
     */
    // await new Promise(resolve => setTimeout(resolve, 10000))

    /**
     * REPORT
     */
    t.equal(actorState(), duckula.State.Idle, 'should in State.Feedbacking before received REPORT')
    testInterpreter.send(duckula.Event.REPORT())
    await sandbox.clock.runAllAsync()
    t.equal(actorState(), duckula.State.Feedbacking, 'should transition to State.Feedbacking after received REPORT')

    /**
     * FEEDBACK: 1
     */
    // console.info(targetSnapshot().context)
    // console.info(targetSnapshot().value)
    testEventList.length = 0
    actorEventList.length = 0
    actorStateList.length = 0
    mockerFixture.mary
      .say(FEEDBACKS[mockerFixture.mary.id]![0])
      .to(mockerFixture.groupRoom)
    await sandbox.clock.runAllAsync()
    t.same(
      testEventList,
      [
        messageEventList.at(-1),
      ],
      'should get MESSAGE events after first feedback',
    )
    t.same(
      actorContext().feedbacks,
      {},
      'should no feedbacks because it will updated only all members have replied',
    )
    t.same(actorStateList, [
      duckula.State.Feedbacking,
    ], 'should in state.Feedbacking')

    /**
     * FEEDBACK: +2 (total 3)
     */
    actorEventList.length = 0
    actorStateList.length = 0
    mockerFixture.mike
      .say(FEEDBACKS[mockerFixture.mike.id]![0])
      .to(mockerFixture.groupRoom)
    // await sandbox.clock.runAllAsync()
    mockerFixture.player
      .say(FEEDBACKS[mockerFixture.player.id]![0])
      .to(mockerFixture.groupRoom)
    await sandbox.clock.runAllAsync()
    t.same(
      actorContext().feedbacks,
      {
        [mockerFixture.mary.id]: FEEDBACKS[mockerFixture.mary.id]![1],
        [mockerFixture.mike.id]: FEEDBACKS[mockerFixture.mike.id]![1],
        [mockerFixture.player.id]: FEEDBACKS[mockerFixture.player.id]![1],
      },
      'should set feedbacks because all members have replied',
    )
    t.same(actorStateList, [
      duckula.State.Feedbacking,
      duckula.State.Feedbacking,
      duckula.State.Feedbacked,
      duckula.State.Feedbacked,
      duckula.State.Responding,
      duckula.State.Idle,
    ], 'should transition through Feedbacking,Feedbacked, Responding, Idle states')
    t.same(actorEventList.map(e => e.type), [
      duckula.Type.MESSAGE,
      duckula.Type.MESSAGE,
      duckula.Type.FEEDBACKS,
      duckula.Type.NOTICE,
      duckula.Type.FEEDBACKS,
      duckula.Type.NEXT,
    ], 'should have MESSAGE, FEEDBACKS, NEXT, NOTICE events')
    // testEventList
    //   .filter(e => e.type === duckula.Type.FEEDBACKS)
    //   .forEach(e => console.info(e))
    t.same(
      testEventList
        .filter(e => e.type === duckula.Type.FEEDBACKS),
      [
        duckula.Event.FEEDBACKS({
          [mockerFixture.mary.id]: FEEDBACKS[mockerFixture.mary.id]![1],
          [mockerFixture.mike.id]: FEEDBACKS[mockerFixture.mike.id]![1],
          [mockerFixture.player.id]: FEEDBACKS[mockerFixture.player.id]![1],
        }),
      ],
      'should have FEEDBACKS event with feedbacks',
    )

    // // console.info('Room message log:')
    // // for (const msg of messageList) {
    // //   const mentionText = (await msg.mentionList())
    // //     .map(c => '@' + c.name()).join(' ')

    // //   console.info(
    // //     '-------\n',
    // //     msg.talker().name(),
    // //     ':',
    // //     mentionText,
    // //     msg.text(),
    // //   )
    // // }

    await sandbox.clock.runAllAsync()
    sandbox.restore()
    server.close()
  }
})
