#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/* eslint-disable sort-keys */
import {
  AnyEventObject,
  interpret,
  createMachine,
  Interpreter,
  AnyInterpreter,
  // spawn,
}                         from 'xstate'
import { test, sinon }    from 'tstest'
import type * as WECHATY  from 'wechaty'
import { createFixture }  from 'wechaty-mocker'
import type { mock }      from 'wechaty-puppet-mock'
import * as Mailbox       from 'mailbox'
import * as CQRS          from 'wechaty-cqrs'

import * as ACTOR                   from '../wechaty-actor/mod.js'
import { events, types, states }    from '../schemas/mod.js'

import * as RegisterActor           from './register-actor.js'

test('registerMachine smoke testing', async t => {
  for await (const fixtures of createFixture()) {
    const {
      mocker,
      wechaty,
    }           = fixtures

    const sandbox = sinon.createSandbox({
      useFakeTimers: true,
    })

    const bus$ = CQRS.from(wechaty.wechaty)
    const wechatyMailbox = ACTOR.from(bus$, wechaty.wechaty.puppet.id)
    wechatyMailbox.open()

    const [ mary, mike ] = mocker.mocker.createContacts(2) as [ mock.ContactMock, mock.ContactMock ]

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

    const REGISTER_MACHINE_ID = 'register-machine-id'
    const PROXY_MACHINE_ID    = 'proxy-machine-id'

    const consumerMachine = createMachine({
      id: PROXY_MACHINE_ID,
      invoke: {
        id: REGISTER_MACHINE_ID,
        src: RegisterActor.machineFactory(wechatyMailbox.address),
      },
      on: {
        '*': {
          actions: Mailbox.actions.proxy(PROXY_MACHINE_ID)(REGISTER_MACHINE_ID),
        },
      },
    })

    const consumerEventList: AnyEventObject[] = []
    const consumerInterpreter = interpret(consumerMachine)
    consumerInterpreter
      .onEvent(e => consumerEventList.push(e))
      .start()

    const registerInterpreter = () => consumerInterpreter.children.get(REGISTER_MACHINE_ID) as Interpreter<any>
    const registerSnapshot    = () => registerInterpreter().getSnapshot()
    const registerContext     = () => registerSnapshot().context as RegisterActor.Context
    const registerState       = () => registerSnapshot().value   as RegisterActor.State

    const registerEventList: AnyEventObject[] = []
    registerInterpreter().onEvent(e => registerEventList.push(e))

    t.equal(registerState(), states.idle, 'should be idle state')
    t.same(registerContext().contacts, [], 'should be empty mention list')

    /**
     * Process a message without mention
     */
    consumerEventList.length = 0
    const messageFutureNoMention = new Promise<WECHATY.Message>(resolve => wechaty.wechaty.once('message', resolve))

    mary.say('register without mentions').to(meetingRoom)
    const noMentionMessage = await messageFutureNoMention

    registerInterpreter().send(
      events.message(noMentionMessage.payload!),
    )
    t.equal(consumerEventList.length, 0, 'should has no message sent to parent right after message')

    t.equal(registerState(), states.parsing, 'should be in parsing state')
    t.same(registerEventList.map(e => e.type), [
      types.MESSAGE,
    ], 'should be MESSAGE event')
    t.same(registerContext().contacts, [], 'should have empty mentioned id list before onDone')

    registerEventList.length = 0
    await sandbox.clock.runAllAsync()
    // consumerEventList.forEach(e => console.info('consumer:', e))
    // registerEventList.forEach(e => console.info('register:', e))
    t.same(consumerEventList, [
      Mailbox.events.CHILD_IDLE('idle'),
      Mailbox.events.CHILD_IDLE('idle'),
    ], 'should have 2 idle event after one message, with empty contacts list for non-mention message')
    t.equal(registerState(), states.idle, 'should be back to idle state')
    t.same(registerEventList.map(e => e.type), [
      ACTOR.types.BATCH_RESPONSE,
      types.MENTION,
      types.NEXT,
      types.INTRODUCE,
      types.IDLE,
      ACTOR.types.RESPONSE,
    ], 'should be BATCH_RESPONSE, INTRODUCE, IDLE, RESPONSE events')
    t.same(registerContext().contacts, [], 'should have empty mentioned id list before onDone')

    /**
     * Process a message with mention
     */
    const messageFutureMentions = new Promise<WECHATY.Message>(resolve => wechaty.wechaty.once('message', resolve))

    const MENTION_LIST = [ mike, mary, mocker.player ]
    mary.say('register with mentions', MENTION_LIST).to(meetingRoom)

    const mentionMessage = await messageFutureMentions
    // console.info('mentionMessage:', mentionMessage.text())

    consumerEventList.length = 0
    registerEventList.length = 0
    registerInterpreter().send(
      events.message(mentionMessage.payload!),
    )
    t.equal(consumerEventList.length, 0, 'should has no message sent to parent right after message')

    t.equal(registerState(), states.parsing, 'should be in parsing state')
    t.same(registerEventList.map(e => e.type), [
      types.MESSAGE,
    ], 'should got MESSAGE event')
    t.same(registerContext().contacts, [], 'should have empty mentioned id list before onDone')

    const CONTACT_MENTION_LIST = await Promise.all(
      MENTION_LIST
        .map(c => wechaty.wechaty.Contact.find({ id: c.id })),
    ) as WECHATY.Contact[]

    // console.info(proxyEventList)
    registerEventList.length = 0

    // await new Promise(r => setTimeout(r, 3))
    await sandbox.clock.runAllAsync()
    consumerEventList.forEach(e => console.info('consumer event:', e))
    t.same(
      consumerEventList,
      [
        Mailbox.events.CHILD_IDLE('idle'),
        Mailbox.events.CHILD_REPLY(
          events.contacts(CONTACT_MENTION_LIST.map(c => c.payload!)),
        ),
        Mailbox.events.CHILD_IDLE('idle'),
      ],
      'should have 2 events after one message with contacts list for mention message',
    )
    t.equal(registerState(), states.idle, 'should be in idle state')
    t.same(registerEventList.map(e => e.type), [
      ACTOR.types.BATCH_RESPONSE,
      types.MENTION,
      types.NEXT,
      types.REPORT,
      ACTOR.types.RESPONSE,
    ], 'should got BATCH_RESPONSE, MENTION, NEXT, REPORT, RESPONSE event')
    t.same(
      Object.values(registerContext().contacts).map(c => c.id),
      MENTION_LIST.map(c =>  c.id),
      'should have mentioned id list before onDone',
    )
    consumerInterpreter.stop()
    sandbox.restore()
  }
})

test.only('registerActor smoke testing', async t => {
  let interpreter: AnyInterpreter

  for await (const fixtures of createFixture()) {
    const {
      mocker,
      wechaty,
    }           = fixtures

    const bus$ = CQRS.from(wechaty.wechaty)
    const wechatyMailbox = ACTOR.from(bus$, wechaty.wechaty.puppet.id)
    wechatyMailbox.open()

    const registerMachine = RegisterActor.machineFactory(wechatyMailbox.address)
    const registerActor = Mailbox.helpers.wrap(registerMachine)

    const CHILD_ID = 'testing-child-id'
    const parentTester = createMachine({
      invoke: {
        id: CHILD_ID,
        src: registerActor,
      },
      on: {
        '*': {
          actions: Mailbox.actions.proxy('TestMachine')(CHILD_ID),
        },
      },
    })

    interpreter = interpret(parentTester)
    const eventList: AnyEventObject[] = []

    interpreter
      .onEvent(e => eventList.push(e))
      .start()

    const [ mary, mike ] = mocker.mocker.createContacts(2) as [mock.ContactMock, mock.ContactMock]

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
      events.message(
        (await messageFutureNoMention).payload!,
      ),
    )
    t.same(
      eventList.map(e => e.type),
      [
        types.MESSAGE,
      ],
      'should receive mailbox events for processing the new MESSAGE event',
    )

    await new Promise(setImmediate)

    const messageFutureMentions = new Promise<WECHATY.Message>(resolve => wechaty.wechaty.once('message', resolve))

    const MENTION_LIST = [ mike, mary, mocker.player ]
    mary.say('register', MENTION_LIST).to(meetingRoom)

    eventList.length = 0
    interpreter.send(
      events.message(
        (await messageFutureMentions).payload!,
      ),
    )
    t.same(eventList.map(e => e.type), [
      types.MESSAGE,
    ], 'should receive mailbox events for processing the new mention MESSAGE event')

    eventList.length = 0
    const idleFuture = new Promise<void>(resolve =>
      interpreter.onEvent(e => {
        // console.info('event:', e)
        if (e.type === types.CONTACTS) {
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
      events.contacts(CONTACT_MENTION_LIST.map(c => c.payload!)),
    ], 'should get CONTACT events with mention list')

  }

  interpreter!.stop()
})
