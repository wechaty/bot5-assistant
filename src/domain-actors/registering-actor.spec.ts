#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/* eslint-disable sort-keys */
import {
  AnyEventObject,
  interpret,
  createMachine,
  Interpreter,
  AnyInterpreter,
}                         from 'xstate'
import { test, sinon }    from 'tstest'
import type * as WECHATY  from 'wechaty'
import { createFixture }  from 'wechaty-mocker'
import type { mock }      from 'wechaty-puppet-mock'
import * as Mailbox       from 'mailbox'
import * as CQRS          from 'wechaty-cqrs'

import * as WechatyActor    from '../wechaty-actor/mod.js'

import RegisteringActor    from './registering-actor.js'

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
    const wechatyMailbox = WechatyActor.from(bus$, wechaty.wechaty.puppet.id)
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

    const mailbox = Mailbox.from(RegisteringActor.machine)
    mailbox.open()

    const consumerMachine = createMachine({
      invoke: {
        id: REGISTER_MACHINE_ID,
        src: RegisteringActor.machine.withContext({
          ...RegisteringActor.initialContext(),
          address: {
            wechaty: String(wechatyMailbox.address),
          },
        }),
      },
      on: {
        '*': {
          actions: Mailbox.actions.proxy('consumerTest')(REGISTER_MACHINE_ID),
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
    const registerContext     = () => registerSnapshot().context as ReturnType<typeof RegisteringActor.initialContext>
    const registerState       = () => registerSnapshot().value   as typeof RegisteringActor.State

    const registerEventList: AnyEventObject[] = []
    registerInterpreter().onEvent(e => registerEventList.push(e))

    t.equal(registerState(), RegisteringActor.State.Idle, 'should be idle state')
    t.same(registerContext().contacts, [], 'should be empty mention list')

    /**
     * Process a message without mention
     */
    consumerEventList.length = 0
    const messageFutureNoMention = new Promise<WECHATY.Message>(resolve => wechaty.wechaty.once('message', resolve))

    mary.say('register without mentions').to(meetingRoom)
    const noMentionMessage = await messageFutureNoMention

    registerInterpreter().send(
      RegisteringActor.Event.MESSAGE(noMentionMessage.payload!),
    )
    t.equal(consumerEventList.length, 0, 'should has no message sent to parent right after message')

    t.equal(registerState(), RegisteringActor.State.Parsing, 'should be in parsing state')
    t.same(registerEventList.map(e => e.type), [
      RegisteringActor.Type.MESSAGE,
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
    t.equal(registerState(), RegisteringActor.State.Idle, 'should be back to idle state')
    t.same(registerEventList.map(e => e.type), [
      WechatyActor.Type.BATCH_RESPONSE,
      RegisteringActor.Type.MENTION,
      RegisteringActor.Type.NEXT,
      RegisteringActor.Type.INTRODUCE,
      RegisteringActor.Type.IDLE,
      WechatyActor.Type.RESPONSE,
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
      RegisteringActor.Event.MESSAGE(mentionMessage.payload!),
    )
    t.equal(consumerEventList.length, 0, 'should has no message sent to parent right after message')

    t.equal(registerState(), RegisteringActor.State.Parsing, 'should be in parsing state')
    t.same(registerEventList.map(e => e.type), [
      RegisteringActor.Type.MESSAGE,
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
        Mailbox.events.CHILD_IDLE('idle'),
        Mailbox.events.CHILD_REPLY(
          RegisteringActor.Event.CONTACTS(CONTACT_MENTION_LIST.map(c => c.payload!)),
        ),
      ],
      'should have 2 events after one message with contacts list for mention message',
    )
    t.equal(registerState(), RegisteringActor.State.Idle, 'should be in idle state')
    t.same(registerEventList.map(e => e.type), [
      WechatyActor.Type.BATCH_RESPONSE,
      RegisteringActor.Type.MENTION,
      RegisteringActor.Type.NEXT,
      RegisteringActor.Type.REPORT,
      WechatyActor.Type.RESPONSE,
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

TODO: continue Huan(20220417
// Huan(202204) FIXME: this test is not working sometimes with race condition
test.only('registerActor smoke testing', async t => {
  let interpreter: AnyInterpreter

  for await (const fixture of createFixture()) {

    const bus$ = CQRS.from(fixture.wechaty.wechaty)
    const wechatyMailbox = WechatyActor.from(bus$, fixture.wechaty.wechaty.puppet.id)
    wechatyMailbox.open()

    const registerMailbox = Mailbox.from(RegisteringActor.machine.withContext({
      ...RegisteringActor.initialContext(),
      address: {
        wechaty: String(wechatyMailbox.address),
      },
    }))
    registerMailbox.open()

    const testMachine = createMachine({
      on: {
        '*': {
          actions: Mailbox.actions.proxy('TestMachine')(registerMailbox),
        },
      },
    })

    interpreter = interpret(testMachine)
    const eventList: AnyEventObject[] = []

    interpreter
      .onEvent(e => eventList.push(e))
      .start()

    const [ mary, mike ] = fixture.mocker.mocker.createContacts(2) as [mock.ContactMock, mock.ContactMock]

    const MEMBER_ID_LIST = [
      mary.id,
      mike.id,
      fixture.mocker.bot.id,
      fixture.mocker.player.id,
    ]

    const meetingRoom = fixture.mocker.mocker.createRoom({
      memberIdList: MEMBER_ID_LIST,
    })

    /**
     * 1. test no-mention
     */
    eventList.length = 0
    const messageFutureNoMention = new Promise<WECHATY.Message>(resolve => fixture.wechaty.wechaty.once('message', resolve))

    mary.say('register').to(meetingRoom)

    const NO_MENTION_MESSAGE = RegisteringActor.Event.MESSAGE(
      (await messageFutureNoMention).payload!,
    )

    interpreter.send(NO_MENTION_MESSAGE)

    await new Promise(setImmediate)
    t.same(eventList, [ NO_MENTION_MESSAGE ], 'should no report contact when there is no mention')

    ;(registerMailbox as Mailbox.impls.Mailbox).internal.target.interpreter!.onTransition(s => {
      console.info('______________________________')
      console.info(`Actor: (${s.history?.value}) + [${s.event.type}] = (${s.value})`)
      console.info('-------------------------')
    })
    ;(registerMailbox as Mailbox.impls.Mailbox).internal.interpreter!.onTransition(s => {
      console.info('______________________________')
      console.info(`Mailbox: (${(s.history?.value as any).child}) + [${s.event.type}] = (${(s.value as any).child})`)
      console.info('-------------------------')
    })
    ;(wechatyMailbox as Mailbox.impls.Mailbox).internal.target.interpreter!.onTransition(s => {
      console.info('______________________________')
      // console.info(`Wechaty: (${(s.history?.value as any).child}) + [${s.event.type}] = (${(s.value as any).child}})`)
      console.info(`Wechaty: (${s.history?.value}) + [${s.event.type}] = (${s.value})`)
      console.info('-------------------------')
    })
    console.info('######################################')
    // await new Promise(resolve => setTimeout(resolve, 100))

    /**
     * 2. test mention
     */
    eventList.length = 0
    const messageFutureMentions = new Promise<WECHATY.Message>(resolve => fixture.wechaty.wechaty.once('message', resolve))

    const MENTION_LIST = [ mike, mary, fixture.mocker.player ]
    mary.say('register', MENTION_LIST).to(meetingRoom)

    const contactsFuture = new Promise(resolve =>
      interpreter.onEvent(e => {
        console.info('event:', e)
        if (e.type === RegisteringActor.Type.CONTACTS) {
          resolve(e)
        }
      }),
    )

    const MESSAGE = RegisteringActor.Event.MESSAGE(
      (await messageFutureMentions).payload!,
    )

    interpreter.send(MESSAGE)

    const CONTACT_MENTION_LIST = await Promise.all(
      MENTION_LIST
        .map(c => fixture.wechaty.wechaty.Contact.find({ id: c.id })),
    ) as WECHATY.Contact[]

    const CONTACTS = await contactsFuture

    // console.info(eventList)
    t.same(
      CONTACTS,
      RegisteringActor.Event.CONTACTS(
        CONTACT_MENTION_LIST.map(c => c.payload!),
      ),
      'should get CONTACT events with mention list',
    )

  }

  interpreter!.stop()
})
