#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/* eslint-disable sort-keys */

import {
  test,
  // sinon,
}                   from 'tstest'

import {
  AnyEventObject,
  interpret,
  createMachine,
  // spawn,
}                   from 'xstate'
import type * as WECHATY from 'wechaty'
import {
  firstValueFrom,
  Subject,
}                   from 'rxjs'

import { createFixture } from 'wechaty-mocker'
import type { mock } from 'wechaty-puppet-mock'

import {
  Events,
  Types,
  States,
}                 from '../schemas/mod.js'

import * as Mailbox from '../mailbox/mod.js'
import {
  registerMachine,
  registerActor,
}                   from './register-actor.js'

test('registerMachine smoke testing', async t => {
  const CHILD_ID = 'child-id'
  const parentTester = createMachine({
    invoke: {
      id: CHILD_ID,
      src: registerMachine,
    },
  })

  const interpreter = interpret(parentTester)
  const eventList: AnyEventObject[] = []

  interpreter
    .onEvent(e => eventList.push(e))
    .start()

  const childRef = interpreter.children.get(CHILD_ID)!
  childRef.subscribe(snapshot => {
    // console.info('child transition to', snapshot.value)
    // console.info('child receiving event', snapshot.event.type)
  })

  // interpreter.subscribe(s => {
  //   console.info('Transition to', s.value)
  //   console.info('Receiving event', s.event.type)
  // })

  let snapshot = childRef.getSnapshot()
  t.equal(snapshot.value, States.idle, 'should be idle state')
  t.same(snapshot.context.contacts, [], 'should be empty mention list')

  for await (const fixtures of createFixture()) {
    const {
      mocker,
      wechaty,
    }           = fixtures

    const [mary, mike] = mocker.mocker.createContacts(2) as [mock.ContactMock, mock.ContactMock]

    const MEMBER_ID_LIST = [
      mary.id,
      mike.id,
      mocker.bot.id,
      mocker.player.id,
    ]

    const meetingRoom = mocker.mocker.createRoom({
      memberIdList: MEMBER_ID_LIST,
    })

    /**
     * Process a message without mention
     */
    eventList.length = 0
    const messageFutureNoMention = new Promise<WECHATY.Message>(resolve => wechaty.wechaty.once('message', resolve))

    mary.say('register without mentions').to(meetingRoom)
    const noMentionMessage = await messageFutureNoMention

    childRef.send(
      Events.MESSAGE(noMentionMessage),
    )
    t.equal(eventList.length, 0, 'should has no message sent to parent right after message')

    snapshot = childRef.getSnapshot()
    t.equal(snapshot.value, States.checking, 'should be in checking state')
    t.equal(snapshot.event.type, Types.MESSAGE, 'should be MESSAGE event')
    t.same(snapshot.context.contacts, [], 'should have empty mentioned id list before onDone')

    await new Promise(setImmediate)
    t.same(eventList.map(e => e.type), [
      Types.CONTACTS,
      Mailbox.Types.IDLE,
    ], 'should have 2 events after one message')
    t.same(
      (eventList[0] as ReturnType<typeof Events.CONTACTS>).payload.contacts, [],
      'should get empty contacts list for no-mention message',
    )

    snapshot = childRef.getSnapshot()
    t.equal(snapshot.value, States.idle, 'should be back to idle state')
    t.equal(snapshot.event.type, 'done.invoke.getContextMessageMentionList', 'should be done.invoke.getContextMessageMentionList event')
    t.same(snapshot.context.contacts, [], 'should have empty mentioned id list before onDone')

    /**
     * Process a message with mention
     */
    const futureContactsEvent = new Promise<void>(resolve =>
      interpreter.subscribe(s => {
        // console.info('event: ', s.event.type)
        s.event.type === Types.CONTACTS && resolve()
      }),
    )

    const messageFutureMentions = new Promise<WECHATY.Message>(resolve => wechaty.wechaty.once('message', resolve))

    const MENTION_LIST = [mike, mary, mocker.player]
    mary.say('register with mentions', MENTION_LIST).to(meetingRoom)

    const mentionMessage = await messageFutureMentions
    // console.info('mentionMessage:', mentionMessage.text())

    eventList.length = 0
    childRef.send(
      Events.MESSAGE(mentionMessage),
    )
    t.equal(eventList.length, 0, 'should has no message sent to parent right after message')

    snapshot = childRef.getSnapshot()
    t.equal(snapshot.value, States.checking, 'should be checking state')
    t.equal(snapshot.event.type, Types.MESSAGE, 'should got MESSAGE event')
    t.same(snapshot.context.contacts, [], 'should have empty mentioned id list before onDone')

    eventList.length = 0
    await new Promise(setImmediate)
    t.equal(eventList.length, 2, 'should has no message sent to parent right after message')
    t.same(eventList.map(e => e.type), [
      Types.CONTACTS,
      Mailbox.Types.IDLE,
    ], 'should have 2 events after one message')
    t.same(
      (eventList[0] as ReturnType<typeof Events.CONTACTS>).payload.contacts.map(c => c.id),
      MENTION_LIST.map(c => c.id),
      'should get empty contacts list for no-mention message',
    )

    snapshot = childRef.getSnapshot()
    t.equal(snapshot.value, States.idle, 'should be in idle state')
    t.equal(snapshot.event.type, 'done.invoke.getContextMessageMentionList', 'should got done.getContextMessageMentionList event')
    t.same(
      snapshot.context.contacts.map(c => c.id),
      MENTION_LIST.map(c =>  c.id),
      'should have mentioned id list before onDone',
    )

    /**
     * Final check
     */
    await futureContactsEvent
    snapshot = childRef.getSnapshot()
    t.equal(snapshot.value, States.idle, 'should be in idle state after processed')
    t.equal(snapshot.event.type, 'done.invoke.getContextMessageMentionList', 'should be done.invoke.getContextMessageMentionList event')
    t.same(
      (snapshot.event as any).data.map((c: any) => c.id),
      MENTION_LIST.map(c => c.id),
      'should get mention list',
    )
  }

  interpreter.stop()
})

test('registerActor smoke testing', async t => {
  const interpreter = interpret(registerActor)
    .start()

  const eventList: AnyEventObject[] = []

  interpreter.subscribe(s => {
    eventList.push(s.event)
    // console.info('Transition to', s.value)
    // console.info('Receiving event', s.event.type)
  })

  let snapshot = interpreter.getSnapshot()

  for await (const fixtures of createFixture()) {
    const {
      mocker,
      wechaty,
    }           = fixtures

    const [mary, mike] = mocker.mocker.createContacts(2) as [mock.ContactMock, mock.ContactMock]

    const MEMBER_ID_LIST = [
      mary.id,
      mike.id,
      mocker.bot.id,
      mocker.player.id,
    ]

    const meetingRoom = mocker.mocker.createRoom({
      memberIdList: MEMBER_ID_LIST,
    })

    const messageFutureNoMention = new Promise<WECHATY.Message>(resolve => wechaty.wechaty.once('message', resolve))

    mary.say('register').to(meetingRoom)

    eventList.length = 0
    interpreter.send(
      Events.MESSAGE(
        await messageFutureNoMention,
      ),
    )
    snapshot = interpreter.getSnapshot()
    t.same(snapshot.value, {
      router: Mailbox.States.idle,
      message: Mailbox.States.idle,
      child: Mailbox.States.busy,
    }, 'should be initial IDLE state')
    t.same(eventList.map(e => e.type), [
      Types.MESSAGE,
      Mailbox.Types.NOTIFY,
      Mailbox.Types.DISPATCH,
      Mailbox.Types.BUSY,
    ], 'should receive mailbox events for processing the new MESSAGE event')

    await new Promise(setImmediate)

    const messageFutureMentions = new Promise<WECHATY.Message>(resolve => wechaty.wechaty.once('message', resolve))

    const MENTION_LIST = [mike, mary, mocker.player]
    mary.say('register', MENTION_LIST).to(meetingRoom)

    eventList.length = 0
    interpreter.send(
      Events.MESSAGE(
        await messageFutureMentions,
      ),
    )

    snapshot = interpreter.getSnapshot()
    t.equal(snapshot.event.type, Mailbox.Types.BUSY, 'should have Mailbox BUSY event')
    t.same(eventList.map(e => e.type), [
      Types.MESSAGE,
      Mailbox.Types.NOTIFY,
      Mailbox.Types.DISPATCH,
      Mailbox.Types.BUSY,
    ], 'should receive mailbox events for processing the new mention MESSAGE event')

    eventList.length = 0
    const idleFuture = new Promise<void>(resolve =>
      interpreter.onEvent(e =>
        e.type === Mailbox.Types.IDLE && resolve(),
      ),
    )
    await idleFuture
    snapshot = interpreter.getSnapshot()
    t.same(eventList.map(e => e.type), [
      Types.CONTACTS,
      Mailbox.Types.IDLE,
      Mailbox.Types.DISPATCH,
    ], 'should get CONTACT events')
    t.same(
      (eventList[0] as ReturnType<typeof Events.CONTACTS>).payload.contacts.map(c => c.id),
      MENTION_LIST.map(c => c.id),
      'should get mention list',
    )
  }

  interpreter.stop()
})
