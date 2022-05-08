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
  Interpreter,
  // spawn,
}                                     from 'xstate'
import { test, sinon }                from 'tstest'
import type * as WECHATY              from 'wechaty'
import { firstValueFrom, from, of }   from 'rxjs'
import { filter, map, mergeMap }      from 'rxjs/operators'
import * as Mailbox                   from 'mailbox'
import * as CQRS                      from 'wechaty-cqrs'
import { isActionOf }                 from 'typesafe-actions'

import * as WechatyActor      from '../../wechaty-actor/mod.js'
import { isDefined }          from '../../pure-functions/is-defined.js'
import { FileToText }         from '../../infrastructure-actors/mod.js'
import { bot5Fixtures }       from '../../fixtures/bot5-fixture.js'
import { skipSelfMessagePayload$ }   from '../../wechaty-actor/cqrs/skip-self-message-payload$.js'

import * as Notice    from '../notice/mod.js'

import duckula, { Context }     from './duckula.js'
import machine                  from './machine.js'

const awaitMessageWechaty = (wechaty: WECHATY.Wechaty) => (sayFn: () => any) => {
  const future = new Promise<WECHATY.Message>(resolve => wechaty.once('message', resolve))
  sayFn()
  return future
}

test('feedback machine smoke testing', async t => {
  for await (const {
    mocker: mockerFixtures,
    wechaty: wechatyFixtures,
  } of bot5Fixtures()) {

    const [ [ FILE, TEXT ] ] = await FileToText.FIXTURES()

    const FIXTURES = {
      room: wechatyFixtures.groupRoom,
      members: [
        wechatyFixtures.mary,
        wechatyFixtures.mike,
        wechatyFixtures.player,
      ],
      feedbacks: {
        mary   : [ 'im mary', 'im mary' ],
        mike   : [ 'im mike', 'im mike' ],
        player : [ FILE,      TEXT ],
      },
    } as const

    const sandbox = sinon.createSandbox({
      useFakeTimers: { now: Date.now() }, // for make TencentCloud API timestamp happy
    })

    const bus$ = CQRS.from(wechatyFixtures.wechaty)
    const wechatyMailbox = WechatyActor.from(bus$, wechatyFixtures.wechaty.puppet.id)

    ;(wechatyMailbox as Mailbox.impls.Mailbox).internal.interpreter.subscribe(s => {
      console.info('>>> wechaty mailbox:', [
        `(${s.history?.value || ''})`.padEnd(30, ' '),
        ' + ',
        `[${s.event.type}]`.padEnd(30, ' '),
        ' = ',
        `(${s.value})`.padEnd(30, ' '),
      ].join(''))
    })

    ;(wechatyMailbox as Mailbox.impls.Mailbox).internal.actor.interpreter?.subscribe(s => {
      console.info('>>> wechaty actor:', [
        `(${s.history?.value || ''})`.padEnd(30, ' '),
        ' + ',
        `[${s.event.type}]`.padEnd(30, ' '),
        ' = ',
        `(${s.value})`.padEnd(30, ' '),
      ].join(''))
    })

    const noticeMailbox = Mailbox.from(
      Notice.machine.withContext({
        ...Notice.initialContext(),
        conversation: mockerFixtures.groupRoom.id,
        actors: {
          wechaty: String(wechatyMailbox.address),
        },
      }),
    )
    noticeMailbox.open()

    const CONTACTS = FIXTURES.members.reduce((acc, member) => ({ ...acc, [member.id]: member.payload }), {})

    const feedbackMailbox = Mailbox.from(
      machine.withContext({
        ...duckula.initialContext(),
        contacts: CONTACTS,
        actors: {
          wechaty: String(wechatyMailbox.address),
          notice: String(noticeMailbox.address),
        },
      }),
    )
    feedbackMailbox.open()

    const TEST_ID = 'TestMachine'
    const testMachine = createMachine({
      id: TEST_ID,
      on: {
        '*': {
          actions: Mailbox.actions.proxy(TEST_ID)(feedbackMailbox),
        },
      },
    })

    const testEventList: AnyEventObject[] = []
    const testInterpreter = interpret(testMachine)
      .onEvent(e => testEventList.push(e))
      .start()

    const feedbackInterpreter = (feedbackMailbox as Mailbox.impls.Mailbox).internal.actor.interpreter!
    const feedbackState   = () => feedbackInterpreter.getSnapshot().value
    const feedbackContext = () => feedbackInterpreter.getSnapshot().context as Context

    const feedbackEventList: AnyEventObject[] = []
    feedbackInterpreter.subscribe(s => {
      feedbackEventList.push(s.event)
      console.info('>>> feedback:', [
        `(${s.history?.value || ''})`.padEnd(30, ' '),
        ' + ',
        `[${s.event.type}]`.padEnd(30, ' '),
        ' = ',
        `(${s.value})`.padEnd(30, ' '),
      ].join(''))
    })

    t.equal(feedbackState(), duckula.State.Idle, 'should be idle state after initial')
    t.same(feedbackContext().contacts, CONTACTS, 'should set contexts to CONTACTS')

    skipSelfMessagePayload$(bus$)(wechatyFixtures.wechaty.puppet.id).pipe(
      map(messagePayload => duckula.Event.MESSAGE(messagePayload)),
    ).subscribe(e => {
      console.info('### duckula.Event.MESSAGE', e)
      testInterpreter.send(e)
    })

    const listenMessage = awaitMessageWechaty(wechatyFixtures.wechaty)

    /**
     * Send MESSAGE event: Mary
     */
    feedbackEventList.length = 0
    await listenMessage(() =>
      mockerFixtures.mary.say(FIXTURES.feedbacks.mary[0]).to(mockerFixtures.groupRoom),
    )
    // await new Promise(setImmediate)
    await sandbox.clock.nextAsync()

    // console.info('feedbackEventList', feedbackEventList)
    t.same(
      feedbackEventList
        .map(e => e.type)
        .filter(e => e !== Mailbox.Type.ACTOR_IDLE),
      [ duckula.Type.MESSAGE ],
      'should get MESSAGE event',
    )
    t.same(feedbackState(), duckula.State.Textualizing, 'should be back to state Textualizing after received a text message')
    await sandbox.clock.runAllAsync()
    t.same(feedbackContext().feedbacks, {
      [wechatyFixtures.mary.id]: FIXTURES.feedbacks.mary[1],
    }, 'should have feedback from mary')
    t.equal(Object.keys(feedbackContext().feedbacks).length, 1, 'should have 1 feedback so far')

    /**
     * Mike
     */
    await listenMessage(() => mockerFixtures.mike.say(FIXTURES.feedbacks.mike[0]).to(mockerFixtures.groupRoom))
    await sandbox.clock.runAllAsync()
    // console.info((snapshot.event.payload as any).message)
    t.same(
      feedbackState(),
      duckula.State.Idle,
      'should be back to state active.idle after received a text message',
    )
    t.same(feedbackContext().feedbacks, {
      [wechatyFixtures.mary.id]: FIXTURES.feedbacks.mary[1],
      [wechatyFixtures.mike.id]: FIXTURES.feedbacks.mike[1],
    }, 'should have feedback from 2 users')
    t.equal(Object.keys(feedbackContext().feedbacks).length, 2, 'should have 2 feedback so far')

    /**
     * Player
     */
    feedbackEventList.length = 0
    await listenMessage(() => mockerFixtures.player.say(FIXTURES.feedbacks.player[0]).to(mockerFixtures.groupRoom))
    await sandbox.clock.nextAsync()
    t.same(
      feedbackEventList
        .map(e => e.type)
        .filter(e => e !== Mailbox.Type.ACTOR_IDLE),
      [ duckula.Type.MESSAGE ],
      'should get MESSAGE event',
    )
    t.equal(feedbackState(), duckula.State.Textualizing, 'should in state Textualizing after received audio message')

    /**
     * Wait for State.Idle of feedback
     */
    const future = firstValueFrom(
      from(feedbackInterpreter as any).pipe(
        // tap((x: any) => console.info('> feedback:', [
        //   `(${x.history?.value || ''})`,
        //   ' + ',
        //   `[${x.event.type}]`,
        //   ' = ',
        //   `(${x.value})`,
        // ].join(''))),
        filter((s: any) => s.value === duckula.State.Idle),
      ),
    )
    /**
     * Huan(202204): even after `sandbox.restore()`, `runAllAsync()` is still require below,
     *  or the `await future` will never resolved.
     *
     * Maybe because this `future` is created before `restore()`?
     */
    sandbox.restore()
    await sandbox.clock.runAllAsync()
    await future

    t.equal(feedbackState(), duckula.State.Idle, 'should in state idle after resolve stt message')
    t.same(feedbackContext().feedbacks, {
      [wechatyFixtures.mary.id]   : FIXTURES.feedbacks.mary[1],
      [wechatyFixtures.mike.id]   : FIXTURES.feedbacks.mike[1],
      [wechatyFixtures.player.id] : FIXTURES.feedbacks.player[1],
    }, 'should have feedback from all users in feedback context')
    t.equal(Object.keys(feedbackContext().feedbacks).length, 3, 'should have all 3 feedbacks in feedback context')

    /**
     * Huan(202201): must use setTimeout instead of setImmediate to make sure the following test pass
     *  it seems that the setImmediate is microtask (however the internet said that it should be a macrotask),
     *    and the setTimeout is macrotask?
     *
     * additional note: if we use `await sandbox.clock.runAllAsync()`, it has to be ran twice.
     *  (the `setImmediate` need to be ran twice too)
     *
     * TODO: why?
     */
    await new Promise(resolve => setTimeout(resolve, 0))
    // await new Promise(setImmediate)

    // console.info('testEventList', testEventList)
    t.same(
      testEventList.filter(isActionOf(duckula.Event.FEEDBACKS)),
      [
        duckula.Event.FEEDBACKS({
          [wechatyFixtures.mary.id]   : FIXTURES.feedbacks.mary[1],
          [wechatyFixtures.mike.id]   : FIXTURES.feedbacks.mike[1],
          [wechatyFixtures.player.id] : FIXTURES.feedbacks.player[1],
        }),
      ],
      'should get feedback EVENT from consumer machine',
    )

    testInterpreter.stop()
  }
})

test('feedback actor smoke testing', async t => {
  for await (const WECHATY_FIXTURES of bot5Fixtures()) {
    const {
      mocker,
      wechaty: wechatyFixtures,
    } = WECHATY_FIXTURES

    const bus$ = CQRS.from(wechatyFixtures.wechaty)
    const wechatyActor = WechatyActor.from(bus$, wechatyFixtures.wechaty.puppet.id)

    const [ [ FILE, TEXT ] ] = await FileToText.FIXTURES()

    const MEMBER_LIST = (await wechatyFixtures.groupRoom.memberAll())
      .filter(isDefined)
      .filter(p => p.id !== mocker.bot.id)

    const FIXTURES = {
      contacts: MEMBER_LIST.reduce((acc, member) => ({ ...acc, [member.id]: member.payload }), {}),
      feedbacks: {
        mary   : [ 'im mary', 'im mary' ],
        mike   : [ 'im mike', 'im mike' ],
        player : [ FILE,      TEXT ],
      },
    } as const

    const feedbackMailbox = Mailbox.from(
      machine.withContext({
        ...duckula.initialContext(),
        contacts: FIXTURES.contacts,
        actors: {
          notice : String(Mailbox.nil.address),
          wechaty  : String(wechatyActor.address),
        },
      }),
    )
    feedbackMailbox.open()

    const TEST_ID = 'TestMacihne'
    const testMachine = createMachine({
      id: TEST_ID,
      on: {
        '*': {
          actions: Mailbox.actions.proxy(TEST_ID)(feedbackMailbox),
        },
      },
    })

    const eventList: AnyEventObject[] = []

    const interpreter = interpret(testMachine)
      .onEvent(e => eventList.push(e))
      .start()

    skipSelfMessagePayload$(bus$)(wechatyFixtures.wechaty.puppet.id).pipe(
      map(messagePayload => duckula.Event.MESSAGE(messagePayload)),
    ).subscribe(e => {
      console.info('### duckula.Event.MESSAGE', e)
      interpreter.send(e)
    })

    const feedbackInterpreter = (feedbackMailbox as Mailbox.impls.Mailbox).internal.actor.interpreter!
    feedbackInterpreter.subscribe(s => console.info('>>> feedback:', [
      `(${s.history?.value || ''})`.padEnd(30, ' '),
      ' + ',
      `[${s.event.type}]`.padEnd(30, ' '),
      ' = ',
      `(${s.value})`.padEnd(30, ' '),
    ].join('')))

    const listenMessage = awaitMessageWechaty(wechatyFixtures.wechaty)

    // console.info('MEMBER_LIST', MEMBER_LIST)

    for (const [ user, [ sayable ] ] of Object.entries(FIXTURES.feedbacks)) {
      eventList.length = 0
      /**
       * Send MESSAGE event
       */
      await listenMessage(() => mocker[user as keyof typeof FIXTURES.feedbacks]
        .say(sayable)
        .to(mocker.groupRoom))

      t.same(
        eventList.map(e => e.type),
        [ duckula.Type.MESSAGE ],
        `should get message events from ${user}`,
      )
    }

    await firstValueFrom(
      from(interpreter).pipe(
        // tap(x => console.info('tap event:', x.event.type)),
        filter(s => s.event.type === duckula.Type.FEEDBACKS),
      ),
    )
    // eventList.forEach(e => console.info(e))
    const EXPECTED_FEEDBACKS = Object.entries(FIXTURES.feedbacks)
      .reduce(
        (acc, cur) => {
          const contact = mocker[cur[0] as keyof typeof mocker]
          const text = cur[1][1]
          return {
            ...acc,
            [contact.id]: text,
          }
        },
        {} as {
          [key in keyof typeof FIXTURES.feedbacks]: string
        },
      )

    // console.info('EXPECTED_FEEDBACKS', EXPECTED_FEEDBACKS)
    t.same(
      eventList.filter(isActionOf(duckula.Event.FEEDBACKS)),
      [
        duckula.Event.FEEDBACKS(EXPECTED_FEEDBACKS),
      ],
      'should get FEEDBACKS event',
    )

    await listenMessage(() => mocker.mary.say(FIXTURES.feedbacks.player[0]).to(mocker.groupRoom))
    eventList.length = 0
    await firstValueFrom(
      from(interpreter).pipe(
        // tap(x => console.info('tap event:', x.event.type)),
        filter(s => s.event.type === duckula.Type.FEEDBACKS),
      ),
    )
    t.same(
      eventList,
      [
        duckula.Event.FEEDBACKS({
          ...EXPECTED_FEEDBACKS,
          [mocker.mary.id] : FIXTURES.feedbacks.player[1],
        }),
      ],
      'should get FEEDBACKS event immediately after mary sent feedback of player once again',
    )

    interpreter.stop()
  }
})
