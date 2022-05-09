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
}                                   from 'xstate'
import { test, sinon }              from 'tstest'
import type * as WECHATY            from 'wechaty'
import { firstValueFrom, from }     from 'rxjs'
import { filter, map, mergeMap }    from 'rxjs/operators'
import * as Mailbox                 from 'mailbox'
import * as CQRS                    from 'wechaty-cqrs'
import { isActionOf }               from 'typesafe-actions'

import * as WechatyActor      from 'wechaty-actor'
import { isDefined }    from '../../pure/mod.js'

import { bot5Fixtures }   from '../../fixtures/bot5-fixture.js'

import duckula, { Context }     from './duckula.js'
import machine                  from './machine.js'

const awaitMessageWechaty = (wechaty: WECHATY.Wechaty) => (sayFn: () => void) => {
  const future = new Promise(resolve => wechaty.once('message', resolve))
  sayFn()
  return future
}

test('meeting machine smoke testing', async t => {
  for await (const {
    mocker: mockerFixtures,
    wechaty: wechatyFixtures,
  } of bot5Fixtures()) {

    const sandbox = sinon.createSandbox({
      useFakeTimers: { now: Date.now() }, // for make TencentCloud API timestamp happy
    })

    const bus$ = CQRS.from(wechatyFixtures.wechaty)
    const wechatyActor = WechatyActor.from(bus$, wechatyFixtures.wechaty.puppet.id)

    const TEST_ID = 'test-id'
    const testMachine = createMachine({
      id: TEST_ID,
      invoke: {
        id: duckula.id,
        src: machine.withContext({
          ...duckula.initialContext(),
          actors: {
            wechaty: String(wechatyActor.address),
            notice: String(Mailbox.nil.address),
            register: String(Mailbox.nil.address),
          },
        }),
      },

      on: {
        '*': {
          actions: Mailbox.actions.proxy(TEST_ID)(duckula.id),
        },
      },
    })

    const testEventList: AnyEventObject[] = []
    const testInterpreter = interpret(testMachine)
      .onEvent(e => testEventList.push(e))
      .start()

    const meetingInterpreter = testInterpreter.children.get(duckula.id) as Interpreter<any>
    const meetingState    = () => meetingInterpreter.getSnapshot().value
    const meetingContext  = () => meetingInterpreter.getSnapshot().context as Context

    const meetingEventList: AnyEventObject[] = []

    meetingInterpreter.subscribe(s => {
      meetingEventList.push(s.event)
      console.info('>>> meeting:', [
        `(${s.history?.value || ''})`.padEnd(30, ' '),
        ' + ',
        `[${s.event.type}]`.padEnd(30, ' '),
        ' = ',
        `(${s.value})`.padEnd(30, ' '),
      ].join(''))
    })

    t.equal(meetingState(), duckula.State.Idle, 'should be idle state after initial')
    t.same(meetingContext().attendees, [], 'should be empty attendee list')

    bus$.pipe(
      // tap(e => console.info('### bus$', e)),
      filter(CQRS.is(CQRS.events.MessageReceivedEvent)),
      map(e => CQRS.queries.GetMessagePayloadQuery(wechatyFixtures.wechaty.puppet.id, e.payload.messageId)),
      mergeMap(CQRS.execute$(bus$)),
      map(response => response.payload.message),
      filter(isDefined),
      map(messagePayload => duckula.Event.MESSAGE(messagePayload)),
    ).subscribe(e => {
      // console.info('### duckula.Event.MESSAGE', e)
      meetingInterpreter.send(e)
    })

    const listenMessage = awaitMessageWechaty(wechatyFixtures.wechaty)

    const SILK = await getSilkFixtures()

    const FIXTURES = {
      room: wechatyFixtures.groupRoom,
      chairs: [
        wechatyFixtures.player,
        wechatyFixtures.mike,
      ],
      members: [
        wechatyFixtures.mary,
        wechatyFixtures.mike,
        wechatyFixtures.player,
        wechatyFixtures.bot,
      ],
      brainstorming: {
        mary   : [ "mary's brainstorming",  "mary's brainstorming" ],
        mike   : [ 'im mike',               'im mike' ],
        player : [ SILK.fileBox,            SILK.text ],
        bot    : [ 'im bot',                'im bot' ],
      },
    } as const

    /**
     * Send CONTACTS event
     */
    testEventList.length = 0
    meetingEventList.length = 0
    meetingInterpreter.send(
      duckula.Event.CONTACTS(
        FIXTURES.members
          .map(c => c.payload)
          .filter(isDefined),
      ),
    )
    // console.info(snapshot.history)
    t.same(meetingEventList.map(e => e.type), [
      duckula.Type.CONTACTS,
    ], 'should get CONTACTS event')
    t.equal(meetingState(), duckula.State.Idle, 'should be state idle')
    t.same(Object.values(meetingContext().attendees).map(c => c.id), FIXTURES.members.map(c => c.id), 'should get context contacts list')

    /**
     * Send MESSAGE event: Mary
     */
    meetingEventList.length = 0
    await listenMessage(() =>
      mockerFixtures.mary.say(FIXTURES.brainstorming.mary[0]).to(mockerFixtures.groupRoom),
    )
    t.same(
      meetingEventList
        .map(e => e.type)
        .filter(e => e !== Mailbox.Type.ACTOR_IDLE),
      [ duckula.Type.MESSAGE ],
      'should get MESSAGE event',
    )
    t.same(meetingState(), duckula.State.Textualizing, 'should be back to state Textualizing after received a text message')
    await sandbox.clock.runAllAsync()
    t.same(meetingContext().feedbacks, {
      [wechatyFixtures.mary.id]: FIXTURES.brainstorming.mary[1],
    }, 'should have feedback from mary')
    t.equal(Object.keys(meetingContext().feedbacks).length, 1, 'should have 1 feedback so far')

    /**
     * Mike
     */
    await listenMessage(() => mockerFixtures.mike.say(FIXTURES.brainstorming.mike[0]).to(mockerFixtures.groupRoom))
    await sandbox.clock.runAllAsync()
    // console.info((snapshot.event.payload as any).message)
    t.same(
      meetingState(),
      duckula.State.Idle,
      'should be back to state active.idle after received a text message',
    )
    t.same(meetingContext().feedbacks, {
      [wechatyFixtures.mary.id]: FIXTURES.brainstorming.mary[1],
      [wechatyFixtures.mike.id]: FIXTURES.brainstorming.mike[1],
    }, 'should have feedback from 2 users')
    t.equal(Object.keys(meetingContext().feedbacks).length, 2, 'should have 2 feedback so far')

    /**
     * Bot
     */
    await listenMessage(() => mockerFixtures.bot.say(FIXTURES.brainstorming.bot[0]).to(mockerFixtures.groupRoom))
    await sandbox.clock.runAllAsync()
    t.same(meetingContext().feedbacks, {
      [wechatyFixtures.mary.id]: FIXTURES.brainstorming.mary[1],
      [wechatyFixtures.mike.id]: FIXTURES.brainstorming.mike[1],
      [wechatyFixtures.bot.id]: FIXTURES.brainstorming.bot[1],
    }, 'should have feedback from 3 users including bot')
    t.equal(Object.keys(meetingContext().feedbacks).length, 3, 'should have 3 feedback so far')

    /**
     * Player
     */
    meetingEventList.length = 0
    await listenMessage(() => mockerFixtures.player.say(FIXTURES.brainstorming.player[0]).to(mockerFixtures.groupRoom))
    t.same(
      meetingEventList
        .map(e => e.type)
        .filter(e => e !== Mailbox.Type.ACTOR_IDLE),
      [ duckula.Type.MESSAGE ],
      'should get MESSAGE event',
    )
    t.equal(meetingState(), duckula.State.Textualizing, 'should in state Textualizing after received audio message')

    /**
     * Wait for State.Idle of feedback
     */
    const future = firstValueFrom(
      from(meetingInterpreter as any).pipe(
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

    t.equal(meetingState(), duckula.State.Idle, 'should in state idle after resolve stt message')
    t.same(meetingContext().feedbacks, {
      [wechatyFixtures.mary.id]   : FIXTURES.brainstorming.mary[1],
      [wechatyFixtures.bot.id]    : FIXTURES.brainstorming.bot[1],
      [wechatyFixtures.mike.id]   : FIXTURES.brainstorming.mike[1],
      [wechatyFixtures.player.id] : FIXTURES.brainstorming.player[1],
    }, 'should have feedback from all users in feedback context')
    t.equal(Object.keys(meetingContext().feedbacks).length, 4, 'should have all 4 feedbacks in feedback context')

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

    t.same(
      testEventList
        .filter(isActionOf(Mailbox.Event.ACTOR_REPLY))
        .map(e => e.payload.message),
      [
        duckula.Event.FEEDBACKS({
          [wechatyFixtures.mary.id]   : FIXTURES.brainstorming.mary[1],
          [wechatyFixtures.bot.id]    : FIXTURES.brainstorming.bot[1],
          [wechatyFixtures.mike.id]   : FIXTURES.brainstorming.mike[1],
          [wechatyFixtures.player.id] : FIXTURES.brainstorming.player[1],
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

    const feedbackMachine = machine.withContext({
      ...duckula.initialContext(),
      actors: {
        notice : String(Mailbox.nil.address),
        register : String(Mailbox.nil.address),
        wechaty  : String(wechatyActor.address),
      },
    })

    const feedbackActor = Mailbox.from(feedbackMachine)
    feedbackActor.open()

    const testMachine = createMachine({
      id: 'TestMachine',
      on: {
        '*': {
          actions: Mailbox.actions.proxy('TestMachine')(feedbackActor),
        },
      },
    })

    const eventList: AnyEventObject[] = []

    const interpreter = interpret(testMachine)
      .onEvent(e => eventList.push(e))
      .start()

    bus$.pipe(
      // tap(e => console.info('### bus$', e)),
      filter(CQRS.is(CQRS.events.MessageReceivedEvent)),
      map(e => CQRS.queries.GetMessagePayloadQuery(wechatyFixtures.wechaty.puppet.id, e.payload.messageId)),
      mergeMap(CQRS.execute$(bus$)),
      map(response => response.payload.message),
      filter(isDefined),
      map(messagePayload => duckula.Event.MESSAGE(messagePayload)),
    ).subscribe(e => {
      // console.info('### duckula.Event.MESSAGE', e)
      interpreter.send(e)
    })

    ;(feedbackActor as Mailbox.impls.Mailbox).internal.actor.interpreter?.subscribe(s => console.info('>>> feedback:', [
      `(${s.history?.value || ''})`.padEnd(30, ' '),
      ' + ',
      `[${s.event.type}]`.padEnd(30, ' '),
      ' = ',
      `(${s.value})`.padEnd(30, ' '),
    ].join('')))

    const listenMessage = awaitMessageWechaty(wechatyFixtures.wechaty)

    const MEMBER_LIST = (await wechatyFixtures.groupRoom.memberAll())
      .map(m => m.payload)
      .filter(isDefined)

    // console.info('MEMBER_LIST', MEMBER_LIST)

    const SILK = await getSilkFixtures()

    const FIXTURES = {
      members: MEMBER_LIST,
      feedbacks: {
        mary   : [ 'im mary',     'im mary' ],
        mike   : [ 'im mike',     'im mike' ],
        player : [ SILK.fileBox,  SILK.text ],
        bot    : [ 'im bot',      'im bot' ],
      },
    } as const

    /**
     * Send initial message to start the feedback
     */
    eventList.length = 0
    ;[
      duckula.Event.CONTACTS(MEMBER_LIST),
    ].forEach(e => interpreter.send(e))

    t.same(
      eventList
        .filter(e => !Mailbox.helpers.isMailboxType(e.type))
        .map(e => e.type),
      [
        duckula.Type.CONTACTS,
      ],
      'should get CONTACTS event',
    )

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
