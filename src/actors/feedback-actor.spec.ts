#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/* eslint-disable sort-keys */

import {
  test,
  sinon,
}                   from 'tstest'

import {
  AnyEventObject,
  interpret,
  createMachine,
  Interpreter,
  // spawn,
}                   from 'xstate'
import type * as WECHATY from 'wechaty'
import {
  firstValueFrom,
  from,
}                   from 'rxjs'
import {
  filter,
  tap,
}                   from 'rxjs/operators'
import { createFixture } from 'wechaty-mocker'
import type { mock } from 'wechaty-puppet-mock'

import * as Mailbox from '../mailbox/mod.js'

import {
  Events,
  States,
  Types,
}           from '../schemas/mod.js'

import * as Feedback from './feedback-actor.js'

import { audioFixtures } from '../to-text/mod.js'
import { isMailboxType } from '../mailbox/types.js'

import { bot5Fixtures } from './bot5-fixture.js'

const awaitMessageWechaty = (wechaty: WECHATY.Wechaty) => (sayFn: () => any) => {
  const future = new Promise<WECHATY.Message>(resolve => wechaty.once('message', resolve))
  sayFn()
  return future
}

test('feedbackMachine smoke testing', async t => {
  const CHILD_ID = 'testing-child-id'
  const proxyMachine = createMachine({
    invoke: {
      id: CHILD_ID,
      src: Feedback.machineFactory(
        Mailbox.nullAddress,
        Mailbox.nullAddress,
      ),
    },
  })

  const proxyEventList: AnyEventObject[] = []
  const testInterpreter = interpret(proxyMachine)
    .onEvent(e => proxyEventList.push(e))
    .start()

  const feedbackRef = testInterpreter.children.get(CHILD_ID) as Interpreter<any>
  const feedbackState = () => feedbackRef.getSnapshot().value
  const feedbackContext = () => feedbackRef.getSnapshot().context as Feedback.Context

  const feedbackEventList: AnyEventObject[] = []
  feedbackRef.subscribe(s => {
    feedbackEventList.push(s.event)
    console.info('  - [new transition] ', s.value, s.event.type)
  })

  t.equal(feedbackState(), States.idle, 'should be idle state after initial')
  t.same(feedbackContext().contacts, [], 'should be empty attendee list')

  for await (const {
    mocker: mockerFixtures,
    wechaty: wechatyFixtures,
  } of bot5Fixtures()) {
    const sandbox = sinon.createSandbox({
      useFakeTimers: { now: Date.now() }, // for make TencentCloud API timestamp happy
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
     proxyEventList.length = 0
     feedbackEventList.length = 0
     feedbackRef.send(
      Events.CONTACTS(FIXTURES.members),
    )
    t.same(
      feedbackEventList.map(e => e.type),
      [
        Types.CONTACTS,
      ],
      'should get CONTACT event',
    )

    // console.info(snapshot.history)
    t.same(feedbackEventList.map(e => e.type), [
      Types.CONTACTS,
    ], 'should get CONTACTS event')
    t.equal(feedbackState(), States.idle, 'should be state idle')
    t.same(feedbackContext().contacts.map(c => c.id), FIXTURES.members.map(c => c.id), 'should get context contacts list')

    /**
     * Send ROOM event
     */
    feedbackEventList.length = 0
    feedbackRef.send([
      Events.ROOM(wechatyFixtures.groupRoom),
    ])
    t.same(feedbackEventList.map(e => e.type), [Types.ROOM], 'should get ROOM event')
    t.same(feedbackState(), States.idle, 'should be state idle')

    /**
     * Send MESSAGE event
     */
    const maryMsg = await listenMessage(() => mockerFixtures.mary.say(FIXTURES.feedbacks.mary).to(mockerFixtures.groupRoom))
    feedbackEventList.length = 0
    feedbackRef.send([
      Events.MESSAGE(maryMsg),
    ])
    // console.info((snapshot.event.payload as any).message)
    t.same(feedbackEventList.map(e => e.type), [Types.MESSAGE], 'should get MESSAGE event')
    t.same(feedbackState(), States.parsing, 'should be back to state parsing after received a text message')

    await sandbox.clock.runToLastAsync()
    t.same(feedbackContext().feedbacks, {
      [wechatyFixtures.mary.id]: FIXTURES.feedbacks.mary,
    }, 'should have feedback from mary')
    t.equal(Object.keys(feedbackContext().feedbacks).length, 1, 'should have 1 feedback so far')

    const mikeMsg = await listenMessage(() => mockerFixtures.mike.say(FIXTURES.feedbacks.mike).to(mockerFixtures.groupRoom))

    // console.info(feedbackMsgs)
    feedbackRef.send(
      Events.MESSAGE(mikeMsg),
    )
    await sandbox.clock.runToLastAsync()
    // console.info((snapshot.event.payload as any).message)
    t.same(
      feedbackState(),
      States.idle,
      'should be back to state active.idle after received a text message',
    )
    t.same(feedbackContext().feedbacks, {
      [wechatyFixtures.mary.id]: FIXTURES.feedbacks.mary,
      [wechatyFixtures.mike.id]: FIXTURES.feedbacks.mike,
    }, 'should have feedback from 2 users')
    t.equal(Object.keys(feedbackContext().feedbacks).length, 2, 'should have 2 feedback so far')

    const botMsg = await listenMessage(() => mockerFixtures.bot.say(FIXTURES.feedbacks.bot).to(mockerFixtures.groupRoom))
    feedbackRef.send(
      Events.MESSAGE(botMsg),
    )
    await sandbox.clock.runToLastAsync()
    t.same(feedbackContext().feedbacks, {
      [wechatyFixtures.mary.id]: FIXTURES.feedbacks.mary,
      [wechatyFixtures.mike.id]: FIXTURES.feedbacks.mike,
      [wechatyFixtures.bot.id]: FIXTURES.feedbacks.bot,
    }, 'should have feedback from 3 users including bot')
    t.equal(Object.keys(feedbackContext().feedbacks).length, 3, 'should have 3 feedback so far')

    const playerMsg = await listenMessage(() => mockerFixtures.player.say(SILK.fileBox).to(mockerFixtures.groupRoom))
    // console.info('msg', msg)
    feedbackEventList.length = 0
    feedbackRef.send(
      Events.MESSAGE(playerMsg),
    )
    t.same(feedbackEventList.map(e => e.type), [
      Types.MESSAGE,
    ], 'should get MESSAGE event')
    t.equal(feedbackState(), States.parsing, 'should in state parsing after received audio message')

    await firstValueFrom(
      from(feedbackRef as any).pipe(
        // tap((x: any) => console.info('tap state:', x.value)),
        // tap((x: any) => console.info('tap event:', x.event.type)),
        filter((s: any) => s.value === States.idle),
      ),
    )
    t.equal(feedbackState(), States.idle, 'should in state idle after resolve stt message')
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
      proxyEventList
        .filter(e => e.type === Mailbox.Types.CHILD_REPLY),
      [
        Mailbox.Events.CHILD_REPLY(
          Events.FEEDBACKS({
            [wechatyFixtures.mary.id]   : FIXTURES.feedbacks.mary,
            [wechatyFixtures.bot.id]    : FIXTURES.feedbacks.bot,
            [wechatyFixtures.mike.id]   : FIXTURES.feedbacks.mike,
            [wechatyFixtures.player.id] : FIXTURES.feedbacks.player,
          }),
        ),
      ],
      'should get feedback EVENT from parent',
    )

    sandbox.restore()
  }

  testInterpreter.stop()
})

test('feedbackActor smoke testing', async t => {

  const feedbackMachine = Feedback.machineFactory(
    Mailbox.nullAddress,
    Mailbox.nullAddress,
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
        actions: Mailbox.Actions.proxyToChild('TestMachine')(CHILD_ID),
      }
    }
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

    const [mary, mike] = mocker.mocker.createContacts(2) as [mock.ContactMock, mock.ContactMock]

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
      Events.CONTACTS(MEMBER_LIST),
      Events.ROOM(MEETING_ROOM),
    ].forEach(e => interpreter.send(e))

    t.same(
      eventList
        .filter(e => !isMailboxType(e.type))
        .map(e => e.type),
      [
        Types.CONTACTS,
        Types.ROOM,
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
      .map(Events.MESSAGE)
      .forEach(e => interpreter.send(e))
    t.same(
      eventList.map(e => e.type),
      Array(4).fill(Types.MESSAGE),
      'should get 4 message events',
    )

    eventList.length = 0
    // eventList.forEach(e => console.info(e))
    await firstValueFrom(
      from(interpreter).pipe(
        // tap(x => console.info('tap event:', x.event.type)),
        filter(s => s.event.type === Types.FEEDBACKS),
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
        Events.FEEDBACKS(EXPECTED_FEEDBACKS),
      ],
      'should get FEEDBACKS event',
    )

    const msg = await listenMessage(() => mary.say(FIXTURES.feedbacks.mike).to(mockMeetingRoom))
    interpreter.send(Events.MESSAGE(msg))
    eventList.length = 0
    await firstValueFrom(
      from(interpreter).pipe(
        tap(x => console.info('tap event:', x.event.type)),
        filter(s => s.event.type === Types.FEEDBACKS),
      ),
    )
    t.same(
      eventList,
      [
        Events.FEEDBACKS({
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
    const context = Feedback.initialContext()
    t.equal(Feedback.ctxNextContact(context), undefined, 'should return undefined when context is empty')

    context.contacts = [
      wechatyFixtures.mary,
      wechatyFixtures.mike,
      wechatyFixtures.player,
      wechatyFixtures.bot,
    ]
    t.equal(Feedback.ctxNextContact(context), wechatyFixtures.mary, 'should return first contact in the list when context.feedbacks is empty')

    context.feedbacks = {
      [wechatyFixtures.mary.id]: 'im mary',
    }
    t.equal(Feedback.ctxNextContact(context), wechatyFixtures.mike, 'should return second contact in the list when context.feedbacks is set to mary feedback')

    context.feedbacks = {
      [wechatyFixtures.mary.id]: 'im mary',
      [wechatyFixtures.mike.id]: 'im mike',
    }
    t.equal(Feedback.ctxNextContact(context), wechatyFixtures.player, 'should return third contact in the list when context.feedbacks is set to mary&mike feedbacks')

    context.feedbacks = {
      [wechatyFixtures.mary.id]: 'im mary',
      [wechatyFixtures.mike.id]: 'im mike',
      [wechatyFixtures.player.id]: 'im player',
      [wechatyFixtures.bot.id]: 'im bot',
    }
    t.equal(Feedback.ctxNextContact(context), undefined, 'should return undefined if everyone has feedbacked')

  }
})
