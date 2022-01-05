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

import { createFixture } from 'wechaty-mocker'
import type { mock } from 'wechaty-puppet-mock'

import {
  Events,
  Types,
  States,
}                 from '../schemas/mod.js'

import * as Mailbox from '../mailbox/mod.js'
import {
  machineFactory,
}                   from './register-actor.js'

test('registerMachine smoke testing', async t => {
  const wechatyMailbox = Mailbox.from(createMachine<{}>({}))
  wechatyMailbox.acquire()

  const registerMachine = machineFactory(wechatyMailbox.address)
  const CHILD_ID = 'child-id'
  const parentTester = createMachine({
    invoke: {
      id: CHILD_ID,
      src: registerMachine,
    },
    on: {
      '*': {
        actions: Mailbox.Actions.proxyToChild(CHILD_ID),
      },
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

    //   Events.MESSAGE(mention
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
    t.equal(snapshot.value, States.updating, 'should be in updating state')
    t.equal(snapshot.event.type, Types.MESSAGE, 'should be MESSAGE event')
    t.same(snapshot.context.contacts, [], 'should have empty mentioned id list before onDone')

    await new Promise(setImmediate)
    t.same(
      eventList,
      [
        Mailbox.Events.CHILD_REPLY(
          Events.CONTACTS([]),
        ),
        Mailbox.Events.CHILD_IDLE('RegisterMachine'),
      ],
      'should have 2 events after one message, with empty contacts listfor non-mention message',
    )

    snapshot = childRef.getSnapshot()
    t.equal(snapshot.value, States.idle, 'should be back to idle state')
    t.equal(snapshot.event.type, 'done.invoke.RegisterMachine.bot5/updating:invocation[0]', 'should be done.invoke.RegisterMachine.bot5/updating:invocation[0] event')
    t.same(snapshot.context.contacts, [], 'should have empty mentioned id list before onDone')

    /**
     * Process a message with mention
     */
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
    t.equal(snapshot.value, States.updating, 'should be updating state')
    t.equal(snapshot.event.type, Types.MESSAGE, 'should got MESSAGE event')
    t.same(snapshot.context.contacts, [], 'should have empty mentioned id list before onDone')

    const CONTACT_MENTION_LIST = await Promise.all(
      MENTION_LIST
        .map(c => wechaty.wechaty.Contact.find({ id: c.id })),
    ) as WECHATY.Contact[]

    eventList.length = 0
    await new Promise(setImmediate)
    t.equal(eventList.length, 2, 'should has no message sent to parent right after message')
    t.same(
      eventList,
      [
        Mailbox.Events.CHILD_REPLY(
          Events.CONTACTS(CONTACT_MENTION_LIST),
        ),
        Mailbox.Events.CHILD_IDLE('RegisterMachine'),
      ],
      'should have 2 events after one message with contacts list for mention message',
    )

    snapshot = childRef.getSnapshot()
    t.equal(snapshot.value, States.idle, 'should be in idle state')
    t.equal(snapshot.event.type, 'done.invoke.RegisterMachine.bot5/updating:invocation[0]', 'should got done.invoke.RegisterMachine.bot5/updating:invocation[0] event')
    t.same(
      snapshot.context.contacts.map(c => c.id),
      MENTION_LIST.map(c =>  c.id),
      'should have mentioned id list before onDone',
    )
  }

  wechatyMailbox.dispose()
  interpreter.stop()
})

test('registerActor smoke testing', async t => {
  const wechatyMailbox = Mailbox.from(createMachine<{}>({}))
  wechatyMailbox.acquire()

  const registerMachine = machineFactory(wechatyMailbox.address)
  const registerActor = Mailbox.wrap(registerMachine)

  const CHILD_ID = 'testing-child-id'
  const parentTester = createMachine({
    invoke: {
      id: CHILD_ID,
      src: registerActor,
    },
    on: {
      '*': {
        actions: Mailbox.Actions.proxyToChild(CHILD_ID),
      },
    },
  })

  const interpreter = interpret(parentTester)
  const eventList: AnyEventObject[] = []

  interpreter
    .onEvent(e => eventList.push(e))
    .start()

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
    t.same(
      eventList.map(e => e.type),
      [
        Types.MESSAGE
      ],
      'should receive mailbox events for processing the new MESSAGE event',
    )

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
    t.same(eventList.map(e => e.type), [
      Types.MESSAGE,
    ], 'should receive mailbox events for processing the new mention MESSAGE event')

    eventList.length = 0
    const idleFuture = new Promise<void>(resolve =>
      interpreter.onEvent(e => {
        // console.info('event:', e)
        if (e.type === Types.CONTACTS) {
         resolve()
        }
      }),
    )
    const CONTACT_MENTION_LIST = await Promise.all(
      MENTION_LIST
        .map(c => wechaty.wechaty.Contact.find({ id: c.id })),
    ) as WECHATY.Contact[]
    await idleFuture
    // console.info(eventList)
    t.same(eventList, [
      Events.CONTACTS(CONTACT_MENTION_LIST),
    ], 'should get CONTACT events with mention list')
  }

  interpreter.stop()
})
