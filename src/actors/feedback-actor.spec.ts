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

import {
  machineFactory,
  mailboxFactory,
}                   from './feedback-actor.js'

import { audioFixtures } from '../to-text/mod.js'
import { isMailboxType } from '../mailbox/types.js'

const awaitMessageWechaty = (wechaty: WECHATY.Wechaty) => (sayFn: () => any) => {
  const future = new Promise<WECHATY.Message>(resolve => wechaty.once('message', resolve))
  sayFn()
  return future
}

test('feedbackMachine smoke testing', async t => {
  const CHILD_ID = 'testing-child-id'
  const testMachine = createMachine({
    invoke: {
      id: CHILD_ID,
      src: machineFactory({ send: () => {} }),
    },
  })

  const eventList: AnyEventObject[] = []

  const testInterpreter = interpret(testMachine)
    .onEvent(e => eventList.push(e))
    .start()

  const childRef = testInterpreter.children.get(CHILD_ID)!
  childRef.subscribe(s => {
    eventList.push(s.event)
    console.info('[new transition]')
    console.info('  state ->', s.value)
    console.info('  event ->', s.event.type)
  })

  let snapshot = childRef.getSnapshot()
  t.equal(snapshot.value, States.idle, 'should be idle state after initial')
  t.same(snapshot.context.contacts, [], 'should be empty attendee list')

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
     * Send CONTACTS event
     */
     eventList.length = 0
     childRef.send(
      Events.CONTACTS(FIXTURES.members),
    )
    t.same(
      eventList.map(e => e.type),
      [
        Mailbox.Types.CHILD_IDLE,
        Types.CONTACTS,
      ],
      'should get CONTACT event',
    )

    snapshot = childRef.getSnapshot()
    // console.info(snapshot.history)
    t.equal(snapshot.event.type, Types.CONTACTS, 'should get CONTACTS event')
    t.equal(snapshot.value, States.idle, 'should be state idle')

    /**
     * Send ROOM event
     */
    eventList.length = 0
    childRef.send([
      Events.ROOM(MEETING_ROOM),
    ])
    snapshot = childRef.getSnapshot()
    t.equal(snapshot.event.type, Types.ROOM, 'should get ROOM event')
    t.same(snapshot.value, States.idle, 'should be state idle')

    /**
     * Send MESSAGE event
     */
    const maryMsg = await listenMessage(() => mary.say(FIXTURES.feedbacks.mary).to(mockMeetingRoom))
    eventList.length = 0
    childRef.send([
      Events.MESSAGE(maryMsg),
    ])
    snapshot = childRef.getSnapshot()
    // console.info((snapshot.event.payload as any).message)
    t.equal(snapshot.event.type, Types.MESSAGE, 'should get MESSAGE event')
    t.same(snapshot.value, States.recognizing, 'should be back to state recognizing after received a text message')

    await new Promise(setImmediate)
    snapshot = childRef.getSnapshot()
    t.same(snapshot.context.feedbacks, { [mary.id]: FIXTURES.feedbacks.mary }, 'should have feedback from mary')
    t.equal(Object.keys(snapshot.context.feedbacks).length, 1, 'should have 1 feedback so far')

    const mikeMsg = await listenMessage(() => mike.say(FIXTURES.feedbacks.mike).to(mockMeetingRoom))

    // console.info(feedbackMsgs)
    childRef.send(
      Events.MESSAGE(mikeMsg),
    )
    await new Promise(setImmediate)
    snapshot = childRef.getSnapshot()
    // console.info((snapshot.event.payload as any).message)
    t.same(
      snapshot.value,
      States.idle,
      'should be back to state active.idle after received a text message',
    )
    t.equal(snapshot.context.feedback, FIXTURES.feedbacks.mike, 'should get mike feedback')
    t.same(snapshot.context.feedbacks, {
      [mary.id]: FIXTURES.feedbacks.mary,
      [mike.id]: FIXTURES.feedbacks.mike,
    }, 'should have feedback from 2 users')
    t.equal(Object.keys(snapshot.context.feedbacks).length, 2, 'should have 2 feedback so far')

    const botMsg = await listenMessage(() => mocker.bot.say(FIXTURES.feedbacks.bot).to(mockMeetingRoom))
    childRef.send(
      Events.MESSAGE(botMsg),
    )
    await new Promise(setImmediate)
    snapshot = childRef.getSnapshot()
    t.same(snapshot.context.feedbacks, {
      [mary.id]: FIXTURES.feedbacks.mary,
      [mike.id]: FIXTURES.feedbacks.mike,
      [mocker.bot.id]: FIXTURES.feedbacks.bot,
    }, 'should have feedback from 3 users including bot')
    t.equal(Object.keys(snapshot.context.feedbacks).length, 3, 'should have 3 feedback so far')

    const playerMsg = await listenMessage(() => mocker.player.say(SILK.fileBox).to(mockMeetingRoom))
    // console.info('msg', msg)
    childRef.send(
      Events.MESSAGE(playerMsg),
    )
    snapshot = childRef.getSnapshot()
    t.equal(snapshot.event.type, Types.MESSAGE, 'should get MESSAGE event')
    t.equal(snapshot.value, States.recognizing, 'should in state stt after received audio message')

    await firstValueFrom(
      from(childRef as any).pipe(
        // tap((x: any) => console.info('tap state:', x.value)),
        // tap((x: any) => console.info('tap event:', x.event.type)),
        filter((s: any) => s.value === States.idle),
      ),
    )
    snapshot = childRef.getSnapshot()
    t.equal(snapshot.value, States.idle, 'should in state idle after resolve stt message')
    t.equal(snapshot.context.feedback, FIXTURES.feedbacks.player, 'should get player feedback')
    t.same(snapshot.context.feedbacks, {
      [mary.id]          : FIXTURES.feedbacks.mary,
      [mocker.bot.id]    : FIXTURES.feedbacks.bot,
      [mike.id]          : FIXTURES.feedbacks.mike,
      [mocker.player.id] : FIXTURES.feedbacks.player,
    }, 'should have feedback from all users')
    t.equal(Object.keys(snapshot.context.feedbacks).length, 4, 'should have all 4 feedbacks')

    // eventList.forEach(e => console.info(e))
    // console.info(eventList
    //   .filter(e => e.type === Mailbox.Types.CHILD_REPLY)[0])

    t.same(
      eventList
        .filter(e => e.type === Mailbox.Types.CHILD_REPLY),
      [
        Mailbox.Events.CHILD_REPLY(
          Events.FEEDBACK({
            [mary.id]          : FIXTURES.feedbacks.mary,
            [mocker.bot.id]    : FIXTURES.feedbacks.bot,
            [mike.id]          : FIXTURES.feedbacks.mike,
            [mocker.player.id] : FIXTURES.feedbacks.player,
          }),
        ),
      ],
      'should get feedback EVENT from parent',
    )
  }

  testInterpreter.stop()
})

test('feedbackActor smoke testing', async t => {

  const feedbackMachine = machineFactory({ send: _ => {} })
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
        filter(s => s.event.type === Types.FEEDBACK),
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
        Events.FEEDBACK(EXPECTED_FEEDBACKS),
      ],
      'should get FEEDBACKS event',
    )

    const msg = await listenMessage(() => mary.say(FIXTURES.feedbacks.mike).to(mockMeetingRoom))
    interpreter.send(Events.MESSAGE(msg))
    eventList.length = 0
    await firstValueFrom(
      from(interpreter).pipe(
        tap(x => console.info('tap event:', x.event.type)),
        filter(s => s.event.type === Types.FEEDBACK),
      ),
    )
    t.same(
      eventList,
      [
        Events.FEEDBACK({
          ...EXPECTED_FEEDBACKS,
          [mary.id] : FIXTURES.feedbacks.mike,
        }),
      ],
      'should get FEEDBACKS event immediately after mary said mike feedback once again',
    )
  }

  interpreter.stop()
})
