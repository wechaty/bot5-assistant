#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/* eslint-disable sort-keys */

import { test, sinon }    from 'tstest'
import {
  AnyEventObject,
  interpret,
  createMachine,
  Interpreter,
  // spawn,
}                         from 'xstate'
import type * as WECHATY  from 'wechaty'
import { firstValueFrom, from }   from 'rxjs'
import { filter, tap, map, mergeMap }            from 'rxjs/operators'
import { createFixture }  from 'wechaty-mocker'
import type { mock }      from 'wechaty-puppet-mock'
import * as Mailbox       from 'mailbox'
import * as CQRS          from 'wechaty-cqrs'

import * as WechatyActor      from '../../wechaty-actor/mod.js'
import { audioFixtures }      from '../../infrastructure-actors/file-to-text/lib/mod.js'
import { removeUndefined }    from '../../utils/remove-undefined.js'

import { bot5Fixtures }   from '../bot5-fixture.js'

import duckula, { Context }     from './duckula.js'
import machine                  from './machine.js'

const awaitMessageWechaty = (wechaty: WECHATY.Wechaty) => (sayFn: () => any) => {
  const future = new Promise<WECHATY.Message>(resolve => wechaty.once('message', resolve))
  sayFn()
  return future
}

test.only('feedbackMachine smoke testing', async t => {
  for await (const {
    mocker: mockerFixtures,
    wechaty: wechatyFixtures,
  } of bot5Fixtures()) {

    const sandbox = sinon.createSandbox({
      useFakeTimers: { now: Date.now() }, // for make TencentCloud API timestamp happy
    })

    const bus$ = CQRS.from(wechatyFixtures.wechaty)
    const wechatyActor = WechatyActor.from(bus$, wechatyFixtures.wechaty.puppet.id)

    const CHILD_ID = 'testing-child-id'
    const consumerMachine = createMachine({
      invoke: {
        id: CHILD_ID,
        src: machine.withContext({
          ...duckula.initialContext(),
          address: {
            wechaty: String(wechatyActor.address),
            noticing: String(Mailbox.nil.address),
            registering: String(Mailbox.nil.address),
          },
        }),
      },
    })

    const consumerEventList: AnyEventObject[] = []
    const consumerInterpreter = interpret(consumerMachine)
      .onEvent(e => consumerEventList.push(e))
      .start()

    const feedbackInterpreter = consumerInterpreter.children.get(CHILD_ID) as Interpreter<any>
    const feedbackState = () => feedbackInterpreter.getSnapshot().value
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
    t.same(feedbackContext().contacts, [], 'should be empty attendee list')

    const subscription = bus$.pipe(
      // tap(e => console.info('### bus$', e)),
      filter(CQRS.is(CQRS.events.MessageReceivedEvent)),
      map(e => CQRS.queries.GetMessagePayloadQuery(wechatyFixtures.wechaty.puppet.id, e.payload.messageId)),
      mergeMap(CQRS.execute$(bus$)),
      map(response => response.payload.message),
      filter(removeUndefined),
      map(messagePayload => duckula.Event.MESSAGE(messagePayload)),
    ).subscribe(e => {
      // console.info('### duckula.Event.MESSAGE', e)
      feedbackInterpreter.send(e)
    })

    const listenMessage = awaitMessageWechaty(wechatyFixtures.wechaty)

    const SILK = audioFixtures.silk

    const FIXTURES = {
      room: wechatyFixtures.groupRoom,
      members: [
        wechatyFixtures.mary,
        wechatyFixtures.mike,
        wechatyFixtures.player,
        wechatyFixtures.bot,
      ],
      feedbacks: {
        mary: 'im mary',
        mike: 'im mike',
        player: SILK.text,
        bot: 'im bot',
      },
    }

    /**
     * Send CONTACTS event
     */
    consumerEventList.length = 0
    feedbackEventList.length = 0
    feedbackInterpreter.send(
      duckula.Event.CONTACTS(
        FIXTURES.members
          .map(c => c.payload)
          .filter(removeUndefined),
      ),
    )
    // console.info(snapshot.history)
    t.same(feedbackEventList.map(e => e.type), [
      duckula.Type.CONTACTS,
    ], 'should get CONTACTS event')
    t.equal(feedbackState(), duckula.State.Idle, 'should be state idle')
    t.same(Object.values(feedbackContext().contacts).map(c => c.id), FIXTURES.members.map(c => c.id), 'should get context contacts list')

    // /**
    //  * Send ROOM event
    //  */
    // feedbackEventList.length = 0
    // feedbackInterpreter.send([
    //   duckula.Event.ROOM(wechatyFixtures.groupRoom),
    // ])
    // t.same(feedbackEventList.map(e => e.type), [ duckula.Type.ROOM ], 'should get ROOM event')
    // t.same(feedbackState(), duckula.State.Idle, 'should be state idle')

    /**
     * Send MESSAGE event
     */
    feedbackEventList.length = 0
    await listenMessage(() => mockerFixtures.mary.say(FIXTURES.feedbacks.mary).to(mockerFixtures.groupRoom))
    // feedbackInterpreter.send([
    //   duckula.Event.MESSAGE(maryMsg),
    // ])
    // console.info((snapshot.event.payload as any).message)
    t.same(
      feedbackEventList
        .map(e => e.type)
        .filter(e => e !== Mailbox.Type.ACTOR_IDLE),
      [ duckula.Type.MESSAGE ],
      'should get MESSAGE event',
    )
    t.same(feedbackState(), duckula.State.Textualizing, 'should be back to state Textualizing after received a text message')

    await sandbox.clock.runToLastAsync()
    t.same(feedbackContext().feedbacks, {
      [wechatyFixtures.mary.id]: FIXTURES.feedbacks.mary,
    }, 'should have feedback from mary')
    t.equal(Object.keys(feedbackContext().feedbacks).length, 1, 'should have 1 feedback so far')

    await listenMessage(() => mockerFixtures.mike.say(FIXTURES.feedbacks.mike).to(mockerFixtures.groupRoom))
    await sandbox.clock.runToLastAsync()
    // console.info((snapshot.event.payload as any).message)
    t.same(
      feedbackState(),
      duckula.State.Idle,
      'should be back to state active.idle after received a text message',
    )
    t.same(feedbackContext().feedbacks, {
      [wechatyFixtures.mary.id]: FIXTURES.feedbacks.mary,
      [wechatyFixtures.mike.id]: FIXTURES.feedbacks.mike,
    }, 'should have feedback from 2 users')
    t.equal(Object.keys(feedbackContext().feedbacks).length, 2, 'should have 2 feedback so far')

    await listenMessage(() => mockerFixtures.bot.say(FIXTURES.feedbacks.bot).to(mockerFixtures.groupRoom))
    await sandbox.clock.runToLastAsync()
    t.same(feedbackContext().feedbacks, {
      [wechatyFixtures.mary.id]: FIXTURES.feedbacks.mary,
      [wechatyFixtures.mike.id]: FIXTURES.feedbacks.mike,
      [wechatyFixtures.bot.id]: FIXTURES.feedbacks.bot,
    }, 'should have feedback from 3 users including bot')
    t.equal(Object.keys(feedbackContext().feedbacks).length, 3, 'should have 3 feedback so far')

    feedbackEventList.length = 0
    await listenMessage(() => mockerFixtures.player.say(SILK.fileBox).to(mockerFixtures.groupRoom))
    t.same(
      feedbackEventList
        .map(e => e.type)
        .filter(e => e !== Mailbox.Type.ACTOR_IDLE),
      [ duckula.Type.MESSAGE ],
      'should get MESSAGE event',
    )
    t.equal(feedbackState(), duckula.State.Textualizing, 'should in state Textualizing after received audio message')

    sandbox.restore()

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
    // await sandbox.clock.runToLastAsync()
    await future

    t.equal(feedbackState(), duckula.State.Idle, 'should in state idle after resolve stt message')
    t.same(feedbackContext().feedbacks, {
      [wechatyFixtures.mary.id]   : FIXTURES.feedbacks.mary,
      [wechatyFixtures.bot.id]    : FIXTURES.feedbacks.bot,
      [wechatyFixtures.mike.id]   : FIXTURES.feedbacks.mike,
      [wechatyFixtures.player.id] : FIXTURES.feedbacks.player,
    }, 'should have feedback from all users')
    t.equal(Object.keys(feedbackContext().feedbacks).length, 4, 'should have all 4 feedbacks')
    // await new Promise(setImmediate)
    /**
     * Huan(202201): must use setTimeout instead of setImmediate to make sure the following test pass
     *  it seems that the setImmediate is microtask (however the internet said that it should be a macrotask),
     *    and the setTimeout is macrotask?
     */
    await sandbox.clock.runToLastAsync()
    // console.info(eventList)
    t.same(
      consumerEventList
        .filter(e => e.type === Mailbox.Type.ACTOR_REPLY),
      [
        Mailbox.Event.ACTOR_REPLY(
          duckula.Event.FEEDBACKS({
            [wechatyFixtures.mary.id]   : FIXTURES.feedbacks.mary,
            [wechatyFixtures.bot.id]    : FIXTURES.feedbacks.bot,
            [wechatyFixtures.mike.id]   : FIXTURES.feedbacks.mike,
            [wechatyFixtures.player.id] : FIXTURES.feedbacks.player,
          }),
        ),
      ],
      'should get feedback EVENT from parent',
    )

    subscription.unsubscribe()
    consumerInterpreter.stop()
  }
})

test('feedbackActor smoke testing', async t => {

  const feedbackMachine = machine.machineFactory(
    // Mailbox.nullAddress,
    // Mailbox.nullAddress,
    Mailbox.nil.address,
    Mailbox.nil.address,
  )
  const feedbackActor = Mailbox.wrap(feedbackMachine)

  const CHILD_ID = 'testing-child-id'
  const testMachine = createMachine({
    invoke: {
      id: CHILD_ID,
      src: feedbackActor,
    },
    on: {
      '*': {
        actions: Mailbox.actions.proxyToChild('TestMachine')(CHILD_ID),
      },
    },
  })

  const eventList: AnyEventObject[] = []

  const interpreter = interpret(testMachine)
    .onEvent(e => eventList.push(e))
    .onTransition(s => {
      console.info('  transition:', s.value, s.event.type)
      // console.info('event:', s.event.type)
    })
    .start()

  for await (const WECHATY_FIXTURES of createFixture()) {
    const {
      mocker,
      wechaty,
    }           = WECHATY_FIXTURES

    const listenMessage = awaitMessageWechaty(wechaty.wechaty)

    const [ mary, mike ] = mocker.mocker.createContacts(2) as [mock.ContactMock, mock.ContactMock]

    const MEMBER_ID_LIST = [
      mary.id,
      mike.id,
      mocker.bot.id,
      mocker.player.id,
    ]
    const mockMeetingRoom = mocker.mocker.createRoom({
      memberIdList: MEMBER_ID_LIST,
    })

    const MEMBER_LIST = (await Promise.all(
      MEMBER_ID_LIST.map(id => wechaty.wechaty.Contact.find({ id })),
    )).filter(Boolean) as WECHATY.Contact[]

    const MEETING_ROOM = await wechaty.wechaty.Room.find({ id: mockMeetingRoom.id })
    if (!MEETING_ROOM) {
      throw new Error('no meeting room')
    }

    const SILK = audioFixtures.silk

    const FIXTURES = {
      room: MEETING_ROOM,
      members: MEMBER_LIST,
      feedbacks: {
        mary: 'im mary',
        mike: 'im mike',
        player: SILK.text,
        bot: 'im bot',
      },
    }

    /**
     * Send initial message to start the feedback
     */
    eventList.length = 0
    ;[
      duckula.Event.CONTACTS(MEMBER_LIST),
      duckula.Event.ROOM(MEETING_ROOM),
    ].forEach(e => interpreter.send(e))

    t.same(
      eventList
        .filter(e => !Mailbox.helpers.isMailboxType(e.type))
        .map(e => e.type),
      [
        duckula.Type.CONTACTS,
        duckula.Type.ROOM,
      ],
      'should get CONTACTS and ROOM event',
    )

    eventList.length = 0
    /**
     * Send MESSAGE event
     */
    ;[
      await listenMessage(() => mary.say(FIXTURES.feedbacks.mary).to(mockMeetingRoom)),
      await listenMessage(() => mike.say(FIXTURES.feedbacks.mike).to(mockMeetingRoom)),
      await listenMessage(() => mocker.bot.say(FIXTURES.feedbacks.bot).to(mockMeetingRoom)),
      await listenMessage(() => mocker.player.say(FIXTURES.feedbacks.player).to(mockMeetingRoom)),
    ]
      .map(duckula.Event.MESSAGE)
      .forEach(e => interpreter.send(e))
    t.same(
      eventList.map(e => e.type),
      Array(4).fill(duckula.Type.MESSAGE),
      'should get 4 message events',
    )

    eventList.length = 0
    // eventList.forEach(e => console.info(e))
    await firstValueFrom(
      from(interpreter).pipe(
        // tap(x => console.info('tap event:', x.event.type)),
        filter(s => s.event.type === duckula.Type.FEEDBACKS),
      ),
    )
    const EXPECTED_FEEDBACKS = {
      [mary.id]          : FIXTURES.feedbacks.mary,
      [mocker.bot.id]    : FIXTURES.feedbacks.bot,
      [mike.id]          : FIXTURES.feedbacks.mike,
      [mocker.player.id] : FIXTURES.feedbacks.player,
    }
    t.same(
      eventList,
      [
        duckula.Event.FEEDBACKS(EXPECTED_FEEDBACKS),
      ],
      'should get FEEDBACKS event',
    )

    const msg = await listenMessage(() => mary.say(FIXTURES.feedbacks.mike).to(mockMeetingRoom))
    interpreter.send(duckula.Event.MESSAGE(msg))
    eventList.length = 0
    await firstValueFrom(
      from(interpreter).pipe(
        tap(x => console.info('tap event:', x.event.type)),
        filter(s => s.event.type === duckula.Type.FEEDBACKS),
      ),
    )
    t.same(
      eventList,
      [
        duckula.Event.FEEDBACKS({
          ...EXPECTED_FEEDBACKS,
          [mary.id] : FIXTURES.feedbacks.mike,
        }),
      ],
      'should get FEEDBACKS event immediately after mary said mike feedback once again',
    )
  }

  interpreter.stop()
})

test('nextContact()', async t => {
  for await (const {
    wechaty: wechatyFixtures,
  } of bot5Fixtures()) {
    const context = machine.initialContext()
    t.equal(machine.ctxNextContact(context), undefined, 'should return undefined when context is empty')

    context.contacts = [
      wechatyFixtures.mary,
      wechatyFixtures.mike,
      wechatyFixtures.player,
      wechatyFixtures.bot,
    ]
    t.equal(machine.ctxNextContact(context), wechatyFixtures.mary, 'should return first contact in the list when context.feedbacks is empty')

    context.feedbacks = {
      [wechatyFixtures.mary.id]: 'im mary',
    }
    t.equal(machine.ctxNextContact(context), wechatyFixtures.mike, 'should return second contact in the list when context.feedbacks is set to mary feedback')

    context.feedbacks = {
      [wechatyFixtures.mary.id]: 'im mary',
      [wechatyFixtures.mike.id]: 'im mike',
    }
    t.equal(machine.ctxNextContact(context), wechatyFixtures.player, 'should return third contact in the list when context.feedbacks is set to mary&mike feedbacks')

    context.feedbacks = {
      [wechatyFixtures.mary.id]: 'im mary',
      [wechatyFixtures.mike.id]: 'im mike',
      [wechatyFixtures.player.id]: 'im player',
      [wechatyFixtures.bot.id]: 'im bot',
    }
    t.equal(machine.ctxNextContact(context), undefined, 'should return undefined if everyone has feedbacked')

  }
})
