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
}                           from 'xstate'
import { map, mergeMap, filter } from 'rxjs/operators'
import { test, sinon }      from 'tstest'
import * as CQRS            from 'wechaty-cqrs'
import { inspect }          from '@xstate/inspect/lib/server.js'
import { WebSocketServer }  from 'ws'
import * as Mailbox         from 'mailbox'

import * as WechatyActor      from '../../wechaty-actor/mod.js'
import { getSilkFixtures }    from '../../fixtures/get-silk-fixtures.js'
import { bot5Fixtures }       from '../../fixtures/bot5-fixture.js'
import { removeUndefined }    from '../../pure-functions/remove-undefined.js'

import * as RegisterDuckula   from '../register/mod.js'
import * as FeedbackDuckula   from '../feedback/mod.js'

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

    const server = new WebSocketServer({
      port: 8888,
    })

    inspect({ server })

    const SILK = await getSilkFixtures()

    const FEEDBACKS = {
      [mockerFixture.mary.id]: 'im mary',
      [mockerFixture.mike.id]: 'im mike',
      [mockerFixture.player.id]: SILK.text,
      [mockerFixture.bot.id]: 'im bot',
    } as const

    const registerActor = Mailbox.from(RegisterDuckula.machine.withContext({
      ...RegisterDuckula.initialContext(),
      actors: {
        wechaty: String(wechatyActor.address),
        noticing: String(Mailbox.nil.address),
      },
    }))
    registerActor.open()

    const feedbackActor = Mailbox.from(FeedbackDuckula.machine.withContext({
      ...FeedbackDuckula.initialContext(),
      actors: {
        wechaty: String(wechatyActor.address),
        notice: String(Mailbox.nil.address),
        register: String(registerActor.address),
      },
    }))
    feedbackActor.open()

    const mailbox = Mailbox.from(machine.withContext({
      ...duckula.initialContext(),
      actors: {
        wechaty  : String(wechatyActor.address),
        register : String(registerActor.address),
        notice : String(Mailbox.nil.address),
      },
    }))
    mailbox.open()

    const actorEventList: EventObject[] = []
    const actorStateList: StateValue[] = []
    ;(mailbox as Mailbox.impls.Mailbox).internal.actor.interpreter!.subscribe(s => {
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

    const actorSnapshot  = () => (mailbox as Mailbox.impls.Mailbox).internal.actor.interpreter!.getSnapshot()
    const actorContext   = () => actorSnapshot().context as Context

    const testMachine = createMachine<any>({
      id: 'TestMachine',
      on: {
        '*': {
          actions: Mailbox.actions.proxy('TestMachine')(mailbox),
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

    const messageList: ReturnType<typeof duckula.Event.MESSAGE>[] = []

    bus$.pipe(
      // tap(e => console.info('### bus$', e)),
      filter(CQRS.is(CQRS.events.MessageReceivedEvent)),
      map(e => CQRS.queries.GetMessagePayloadQuery(wechatyFixture.wechaty.puppet.id, e.payload.messageId)),
      mergeMap(CQRS.execute$(bus$)),
      map(response => response.payload.message),
      filter(removeUndefined),
      map(messagePayload => duckula.Event.MESSAGE(messagePayload)),
    ).subscribe(e => {
      console.info('### duckula.Event.MESSAGE', e)
      messageList.push(e)
      testInterpreter.send(e)
    })

    /**
     * Events.ROOM(groupRoom) - setting room
     */
    actorEventList.length = 0
    actorStateList.length = 0
    testInterpreter.send(duckula.Event.ROOM(wechatyFixture.groupRoom.payload!))
    testInterpreter.send(duckula.Event.REPORT())
    await sandbox.clock.runToLastAsync()
    t.equal(
      actorContext().room?.id,
      wechatyFixture.groupRoom.id,
      'should set room to context',
    )
    t.same(actorStateList, [
      duckula.State.Idle,
      duckula.State.Reporting,
      duckula.State.Registering,
    ], 'should in state.{idle,reporting,registering}')

    /**
     * XState Issue #2931 - https://github.com/statelyai/xstate/issues/2931
     *  "An unexpected error has occurred" with statecharts.io/inspect #2931
     */
    // await new Promise(resolve => setTimeout(resolve, 10000))

    /**
     * Events.MESSAGE(message) - no mentions
     */
    mockerFixture.player.say('hello, no mention to anyone').to(mockerFixture.groupRoom)
    await sandbox.clock.runAllAsync()
    t.same(actorSnapshot().value, duckula.State.Registering, 'should in State.Segistering if no mention')

    /**
     * Events.MESSAGE(message) - with mentions
     */
    actorEventList.length = 0
    actorStateList.length = 0
    testEventList.length = 0
    mockerFixture.player
      .say('register mary & mike by mention them', [
        mockerFixture.mary,
        mockerFixture.mike,
        mockerFixture.player,
      ])
      .to(mockerFixture.groupRoom)
    await sandbox.clock.runAllAsync()
    // console.info('targetStateList', targetStateList)
    // console.info('proxyEventList', proxyEventList)
    t.same(
      Object.values(actorContext().contacts)
        .map(c => c.id),
      [
        mockerFixture.mary.id,
        mockerFixture.mike.id,
        mockerFixture.player.id,
      ],
      'should set contacts to mary, mike',
    )
    t.same(actorStateList, [
      duckula.State.Registering,
      duckula.State.Registering,
      duckula.State.Registered,
      duckula.State.Registered,
      duckula.State.Completing,
      duckula.State.Feedbacking,
    ], 'should transition to Registering, Registered, Completing, and Feedbacking states')
    t.same(actorEventList.map(e => e.type), [
      duckula.Type.MESSAGE,
      duckula.Type.CONTACTS,
      duckula.Type.NEXT,
      duckula.Type.NOTICE,
      duckula.Type.NEXT,
      duckula.Type.NEXT,
    ], 'should have MESSAGE,CONTACTS,NOTICE event')

    // console.info(targetSnapshot().context)
    // console.info(targetSnapshot().value)
    actorEventList.length = 0
    actorStateList.length = 0
    mockerFixture.mary
      .say(FEEDBACKS[mockerFixture.mary.id])
      .to(mockerFixture.groupRoom)
    await sandbox.clock.runAllAsync()
    t.same(
      actorContext().feedbacks,
      {},
      'should no feedbacks because it will updated only all members have replied',
    )
    t.same(actorStateList, [
      duckula.State.Feedbacking,
    ], 'should in state.Feedbacking')

    actorEventList.length = 0
    actorStateList.length = 0
    mockerFixture.mike
      .say(FEEDBACKS[mockerFixture.mike.id])
      .to(mockerFixture.groupRoom)
    mockerFixture.player
      .say(FEEDBACKS[mockerFixture.player.id])
      .to(mockerFixture.groupRoom)
    await sandbox.clock.runAllAsync()
    t.same(
      actorContext().feedbacks,
      {
        [mockerFixture.mary.id]: FEEDBACKS[mockerFixture.mary.id],
        [mockerFixture.mike.id]: FEEDBACKS[mockerFixture.mike.id],
        [mockerFixture.player.id]: FEEDBACKS[mockerFixture.player.id],
      },
      'should set feedbacks because all members have replied',
    )
    t.same(actorStateList, [
      duckula.State.Feedbacking,
      duckula.State.Feedbacking,
      duckula.State.Feedbacking,
      duckula.State.Feedbacked,
      duckula.State.Feedbacked,
      duckula.State.Completing,
      duckula.State.Completed,
      duckula.State.Completed,
      duckula.State.Idle,
    ], 'should transition through Feedbacking,Feedbacked, Completing, Completed, Idle states')
    t.same(actorEventList.map(e => e.type), [
      duckula.Type.MESSAGE,
      duckula.Type.MESSAGE,
      duckula.Type.FEEDBACKS,
      duckula.Type.NEXT,
      duckula.Type.NOTICE,
      duckula.Type.NEXT,
      duckula.Type.COMPLETE,
      duckula.Type.NOTICE,
      duckula.Type.FEEDBACKS,
    ], 'should have MESSAGE, FEEDBACKS, NEXT, NOTICE, COMPLETE events')
    // testEventList
    //   .filter(e => e.type === duckula.Type.FEEDBACKS)
    //   .forEach(e => console.info(e))
    t.same(
      testEventList
        .filter(e => e.type === duckula.Type.FEEDBACKS),
      [
        duckula.Event.FEEDBACKS({
          [mockerFixture.mary.id]: FEEDBACKS[mockerFixture.mary.id]!,
          [mockerFixture.mike.id]: FEEDBACKS[mockerFixture.mike.id]!,
          [mockerFixture.player.id]: FEEDBACKS[mockerFixture.player.id]!,
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
