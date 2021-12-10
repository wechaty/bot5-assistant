#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/* eslint-disable sort-keys */

import {
  test,
  // sinon,
}                   from 'tstest'

import {
  interpret,
  // spawn,
}                   from 'xstate'
import type * as WECHATY from 'wechaty'
import {
  lastValueFrom,
  Subject,
  from,
}                   from 'rxjs'

import { createFixture } from 'wechaty-mocker'
import type { mock } from 'wechaty-puppet-mock'

import * as events  from './events.js'
import * as types   from './types.js'
import * as states  from './states.js'

import {
  feedbackMachine,
}                   from './feedback-machine.js'

const awaitMessageWechaty = (wechaty: WECHATY.Wechaty) => (sayFn: () => any) => {
  const future = new Promise<WECHATY.Message>(resolve => wechaty.once('message', resolve))
  sayFn()
  return future
}

test('register machine', async t => {
  const interpreter = interpret(feedbackMachine)
    .start()

  interpreter.subscribe(x => console.info('faint:', x.value, x.event.type))

  // const doneFuture = lastValueFrom(from(interpreter))

  let snapshot = interpreter.getSnapshot()
  t.equal(snapshot.value, states.idle, 'should be registering state')
  t.same(snapshot.context.attendees, [], 'should be empty attendee list')

  for await (const WECHATY_FIXTURES of createFixture()) {
    const {
      mocker,
      wechaty,
    }           = WECHATY_FIXTURES

    const listenMessage = awaitMessageWechaty(wechaty.wechaty)

    const { bot, player } = mocker
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

    const FIXTURES = {
      room: MEETING_ROOM,
      members: MEMBER_LIST,
      feedbacks: {
        mary: 'im mary',
        mike: 'im mike',
        player: 'im player',
        bot: 'im bot',
      },
    }

    let msg: WECHATY.Message

    interpreter.send(
      events.START(),
    )

    snapshot = interpreter.getSnapshot()
    // console.info(snapshot.history)
    t.equal(snapshot.event.type, types.START, 'should get START event')
    t.equal(snapshot.value, states.aborted, 'should be state aborted if no meeting room & attendees set')

    interpreter.start()

    interpreter.send([
      events.RESET(),
      events.ATTENDEES(MEMBER_LIST),
      events.ROOM(MEETING_ROOM),
      events.START(),
    ])
    snapshot = interpreter.getSnapshot()
    t.equal(snapshot.event.type, types.START, 'should get START event')
    t.equal(snapshot.value, states.listening, 'should be state listening if meeting room & attendees has been set')
    t.equal(snapshot.context.attendees.length, MEMBER_LIST.length, `should have ${MEMBER_LIST.length} attendees`)
    t.equal(snapshot.context.room, MEETING_ROOM, 'should have meeting room set')

    msg = await listenMessage(() => mary.say(FIXTURES.feedbacks.mary).to(mockMeetingRoom))
    interpreter.send([
      events.MESSAGE(msg),
    ])
    snapshot = interpreter.getSnapshot()
    // console.info((snapshot.event.payload as any).message)
    t.equal(snapshot.event.type, types.MESSAGE, 'should get MESSAGE event')
    t.equal(snapshot.value, states.listening, 'should be back to state listening after received a text message')
    t.equal(snapshot.context.feedback, FIXTURES.feedbacks.mary, 'should have feedback set')
    t.same(snapshot.context.feedbacks, { [mary.id]: FIXTURES.feedbacks.mary }, 'should have feedback from mary')
    t.equal(Object.keys(snapshot.context.feedbacks).length, 1, 'should have 1 feedback so far')

    const feedbackMsgs = [
      await listenMessage(() => bot.say(FIXTURES.feedbacks.bot).to(mockMeetingRoom)),
      await listenMessage(() => mike.say(FIXTURES.feedbacks.mike).to(mockMeetingRoom)),
    ]

    // console.info(feedbackMsgs)
    interpreter.send(
      feedbackMsgs.map(events.MESSAGE),
      // events.MESSAGE(feedbackMsgs[1]),
    )
    snapshot = interpreter.getSnapshot()
    // console.info((snapshot.event.payload as any).message)
    t.equal(snapshot.event.type, types.MESSAGE, 'should get MESSAGE event')
    t.equal(snapshot.value, states.listening, 'should be back to state listening after received a text message')
    t.equal(snapshot.context.feedback, FIXTURES.feedbacks.mike, 'should get mike feedback')
    t.same(snapshot.context.feedbacks, {
      [mary.id]: FIXTURES.feedbacks.mary,
      [bot.id]: FIXTURES.feedbacks.bot,
      [mike.id]: FIXTURES.feedbacks.mike,
    }, 'should have feedback from 3 users')
    t.equal(Object.keys(snapshot.context.feedbacks).length, 3, 'should have 3 feedback so far')

    msg = await listenMessage(() => player.say(FIXTURES.feedbacks.player).to(mockMeetingRoom))
    interpreter.send(
      events.MESSAGE(msg),
    )
    snapshot = interpreter.getSnapshot()
    t.equal(snapshot.event.type, types.MESSAGE, 'should get MESSAGE event')
    t.equal(snapshot.value, states.completed, 'should in state complete after received all feedbacks')
    t.equal(snapshot.context.feedback, FIXTURES.feedbacks.player, 'should get player feedback')
    t.same(snapshot.context.feedbacks, {
      [mary.id]: FIXTURES.feedbacks.mary,
      [bot.id]: FIXTURES.feedbacks.bot,
      [mike.id]: FIXTURES.feedbacks.mike,
      [player.id]: FIXTURES.feedbacks.player,
    }, 'should have feedback from all users')
    t.equal(Object.keys(snapshot.context.feedbacks).length, 4, 'should have all 4 feedbacks')
  }

  interpreter.stop()
})
