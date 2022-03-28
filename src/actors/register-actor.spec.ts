#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/* eslint-disable sort-keys */
import {
  AnyEventObject,
  interpret,
  createMachine,
  Interpreter,
  // spawn,
}                         from 'xstate'
import { test, sinon }    from 'tstest'
import type * as WECHATY  from 'wechaty'
import { createFixture }  from 'wechaty-mocker'
import type { mock }      from 'wechaty-puppet-mock'

import { events, types, states }    from '../schemas/mod.js'
import * as Mailbox                 from '../mailbox/mod.js'
import * as Register                from './register-actor.js'

test('registerMachine smoke testing', async t => {
  const registerMachine = Register.machineFactory(Mailbox.nil.address)
  const REGISTER_MACHINE_ID = 'register-machine-id'
  const PROXY_MACHINE_ID = 'proxy-machine-id'
  const proxyMachine = createMachine({
    id: PROXY_MACHINE_ID,
    invoke: {
      id: REGISTER_MACHINE_ID,
      src: registerMachine,
    },
    on: {
      '*': {
        actions: Mailbox.Actions.proxyToChild(PROXY_MACHINE_ID)(REGISTER_MACHINE_ID),
      },
    },
  })

  const proxyEventList: AnyEventObject[] = []
  const proxyInterpreter = interpret(proxyMachine)
  proxyInterpreter
    .onEvent(e => proxyEventList.push(e))
    .start()

  const registerRef      = () => proxyInterpreter.children.get(REGISTER_MACHINE_ID) as Interpreter<any>
  const registerSnapshot = () => registerRef().getSnapshot()
  const registerContext  = () => registerSnapshot().context as Register.Context
  const registerState    = () => registerSnapshot().value as Register.States

  const registerEventList: AnyEventObject[] = []
  registerRef().onEvent(e => registerEventList.push(e))

  t.equal(registerState(), states.idle, 'should be idle state')
  t.same(registerContext().contacts, [], 'should be empty mention list')

  for await (const fixtures of createFixture()) {
    const {
      mocker,
      wechaty,
    }           = fixtures

    const sandbox = sinon.createSandbox({
      useFakeTimers: true,
    })

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
    proxyEventList.length = 0
    const messageFutureNoMention = new Promise<WECHATY.Message>(resolve => wechaty.wechaty.once('message', resolve))

    mary.say('register without mentions').to(meetingRoom)
    const noMentionMessage = await messageFutureNoMention

    registerRef().send(
      events.message(noMentionMessage),
    )
    t.equal(proxyEventList.length, 0, 'should has no message sent to parent right after message')

    t.equal(registerState(), states.parsing, 'should be in parsing state')
    t.same(registerEventList.map(e => e.type), [
      types.MESSAGE,
    ], 'should be MESSAGE event')
    t.same(registerContext().contacts, [], 'should have empty mentioned id list before onDone')

    registerEventList.length = 0
    await sandbox.clock.runToLastAsync()
    t.same(proxyEventList, [
      Mailbox.Events.CHILD_IDLE('idle'),
    ], 'should have 1 idle event after one message, with empty contacts listfor non-mention message')
    t.equal(registerState(), states.idle, 'should be back to idle state')
    t.same(registerEventList.map(e => e.type), [
      'done.invoke.RegisterMachine.bot5/parsing:invocation[0]',
      types.MENTION,
      types.IDLE,
    ], 'should be done.invoke.RegisterMachine.bot5/parsing:invocation[0], MENTION, IDLE events')
    t.same(registerContext().contacts, [], 'should have empty mentioned id list before onDone')

    /**
     * Process a message with mention
     */
    const messageFutureMentions = new Promise<WECHATY.Message>(resolve => wechaty.wechaty.once('message', resolve))

    const MENTION_LIST = [mike, mary, mocker.player]
    mary.say('register with mentions', MENTION_LIST).to(meetingRoom)

    const mentionMessage = await messageFutureMentions
    // console.info('mentionMessage:', mentionMessage.text())

    proxyEventList.length = 0
    registerEventList.length = 0
    registerRef().send(
      events.message(mentionMessage),
    )
    t.equal(proxyEventList.length, 0, 'should has no message sent to parent right after message')

    t.equal(registerState(), states.parsing, 'should be in parsing state')
    t.same(registerEventList.map(e => e.type), [
      types.MESSAGE,
    ], 'should got MESSAGE event')
    t.same(registerContext().contacts, [], 'should have empty mentioned id list before onDone')

    const CONTACT_MENTION_LIST = await Promise.all(
      MENTION_LIST
        .map(c => wechaty.wechaty.Contact.find({ id: c.id })),
    ) as WECHATY.Contact[]
    t.equal(proxyEventList.length, 0, 'should no event in eventList')

    registerEventList.length = 0
    // await new Promise(r => setTimeout(r, 3))
    await sandbox.clock.runToLastAsync()
    t.same(
      proxyEventList,
      [
        Mailbox.Events.CHILD_IDLE('idle'),
        Mailbox.Events.CHILD_REPLY(
          events.contacts(CONTACT_MENTION_LIST),
        ),
      ],
      'should have 2 events after one message with contacts list for mention message',
    )
    t.equal(registerState(), states.idle, 'should be in idle state')
    t.same(registerEventList.map(e => e.type), [
      'done.invoke.RegisterMachine.bot5/parsing:invocation[0]',
      types.MENTION,
      types.REPORT,
    ], 'should got done.invoke.RegisterMachine.bot5/parsing:invocation[0], MENTION, REPORT event')
    t.same(
      registerContext().contacts.map(c => c.id),
      MENTION_LIST.map(c =>  c.id),
      'should have mentioned id list before onDone',
    )
    proxyInterpreter.stop()
    sandbox.restore()
  }
})

test('registerActor smoke testing', async t => {
  const wechatyMailbox = Mailbox.from(createMachine<{}>({}))
  wechatyMailbox.acquire()

  const registerMachine = Register.machineFactory(wechatyMailbox.address)
  const registerActor = Mailbox.wrap(registerMachine)

  const CHILD_ID = 'testing-child-id'
  const parentTester = createMachine({
    invoke: {
      id: CHILD_ID,
      src: registerActor,
    },
    on: {
      '*': {
        actions: Mailbox.Actions.proxyToChild('TestMachine')(CHILD_ID),
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
      events.message(
        await messageFutureNoMention,
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

    const MENTION_LIST = [mike, mary, mocker.player]
    mary.say('register', MENTION_LIST).to(meetingRoom)

    eventList.length = 0
    interpreter.send(
      events.message(
        await messageFutureMentions,
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
      events.contacts(CONTACT_MENTION_LIST),
    ], 'should get CONTACT events with mention list')
  }

  interpreter.stop()
})
