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
  AnyInterpreter,
}                                   from 'xstate'
import { map, mergeMap, filter }    from 'rxjs/operators'
import { test, sinon }              from 'tstest'
import type * as WECHATY            from 'wechaty'
import { createFixture }            from 'wechaty-mocker'
import type { mock }                from 'wechaty-puppet-mock'
import * as Mailbox                 from 'mailbox'
import * as CQRS                    from 'wechaty-cqrs'
import { isActionOf }               from 'typesafe-actions'

import * as WechatyActor    from '../../wechaty-actor/mod.js'
import { removeUndefined } from '../../pure-functions/remove-undefined.js'

import duckula, { Events }    from './duckula.js'
import machine                from './machine.js'
import { bot5Fixtures } from '../../fixtures/bot5-fixture.js'

test('register machine smoke testing', async t => {
  for await (const fixtures of createFixture()) {
    const {
      mocker: mockerFixture,
      wechaty: wechatyFixture,
    }           = fixtures

    const sandbox = sinon.createSandbox({
      useFakeTimers: true,
    })

    const bus$ = CQRS.from(wechatyFixture.wechaty)
    const wechatyMailbox = WechatyActor.from(bus$, wechatyFixture.wechaty.puppet.id)
    wechatyMailbox.open()

    const [ mary, mike ] = mockerFixture.mocker.createContacts(2) as [ mock.ContactMock, mock.ContactMock ]

    const MEMBER_ID_LIST = [
      mary.id,
      mike.id,
      mockerFixture.bot.id,
      mockerFixture.player.id,
    ]

    //   Events.MESSAGE(mention
    const meetingRoom = mockerFixture.mocker.createRoom({
      memberIdList: MEMBER_ID_LIST,
    })

    const REGISTER_MACHINE_ID = 'register-machine-id'

    const mailbox = Mailbox.from(machine)
    mailbox.open()

    const consumerMachine = createMachine({
      invoke: {
        id: REGISTER_MACHINE_ID,
        src: machine.withContext({
          ...duckula.initialContext(),
          actors: {
            wechaty: String(wechatyMailbox.address),
            noticing: String(Mailbox.nil.address),
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

    const registerInterpreter = consumerInterpreter.children.get(REGISTER_MACHINE_ID) as Interpreter<any>
    const registerSnapshot    = () => registerInterpreter.getSnapshot()
    const registerContext     = () => registerSnapshot().context as ReturnType<typeof duckula.initialContext>
    const registerState       = () => registerSnapshot().value   as typeof duckula.State

    const messageEventList: Events['MESSAGE'][] = []
    bus$.pipe(
      // tap(e => console.info('### bus$', e)),
      filter(CQRS.is(CQRS.events.MessageReceivedEvent)),
      map(e => CQRS.queries.GetMessagePayloadQuery(wechatyFixture.wechaty.puppet.id, e.payload.messageId)),
      mergeMap(CQRS.execute$(bus$)),
      map(response => response.payload.message),
      filter(removeUndefined),
      map(messagePayload => duckula.Event.MESSAGE(messagePayload)),
    ).subscribe(e => {
      // console.info('### duckula.Event.MESSAGE', e)
      messageEventList.push(e)
      registerInterpreter.send(e)
    })

    const registerEventList: AnyEventObject[] = []
    registerInterpreter.onEvent(e => registerEventList.push(e))

    t.equal(registerState(), duckula.State.Idle, 'should be idle state')
    t.same(registerContext().contacts, [], 'should be empty mention list')

    /**
     * Process a message without mention
     */
    consumerEventList.length = 0
    const messageFutureNoMention = new Promise(resolve => wechatyFixture.wechaty.once('message', resolve))

    mary.say('register without mentions').to(meetingRoom)
    await messageFutureNoMention
    t.equal(consumerEventList.length, 0, 'should has no message sent to parent right after message')

    t.equal(registerState(), duckula.State.Loading, 'should be in Loading state')
    t.same(registerEventList.map(e => e.type), [
      duckula.Type.MESSAGE,
      duckula.Type.NEXT,
    ], 'should be MESSAGE event')
    t.same(registerContext().contacts, [], 'should have empty mentioned id list before onDone')

    registerEventList.length = 0
    await sandbox.clock.runAllAsync()
    // consumerEventList.forEach(e => console.info('consumer:', e))
    // registerEventList.forEach(e => console.info('register:', e))
    t.same(consumerEventList, [
      Mailbox.Event.ACTOR_IDLE(),
      Mailbox.Event.ACTOR_IDLE(),
    ], 'should have 2 idle event after one message, with empty contacts list for non-mention message')
    t.equal(registerState(), duckula.State.Idle, 'should be back to idle state')
    t.same(registerEventList.map(e => e.type), [
      WechatyActor.Type.BATCH_RESPONSE,
      duckula.Type.MENTIONS,
      duckula.Type.NEXT,
      duckula.Type.INTRODUCE,
      duckula.Type.NEXT,
      duckula.Type.NOTICE,
    ], 'should be BATCH_RESPONSE, MENTION, NEXT, INTRODUCE, NOTICE events')
    t.same(registerContext().contacts, [], 'should have empty mentioned id list before onDone')

    /**
     * Process a message with mention
     */
    consumerEventList.length = 0
    registerEventList.length = 0
    const MENTION_LIST = [ mike, mary, mockerFixture.player ]

    const messageFutureMentions = new Promise(resolve => wechatyFixture.wechaty.once('message', resolve))
    mary.say('register with mentions', MENTION_LIST).to(meetingRoom)
    await messageFutureMentions
    // console.info('mentionMessage:', mentionMessage.text())

    t.equal(consumerEventList.length, 0, 'should has no message sent to parent right after message')

    t.equal(registerState(), duckula.State.Loading, 'should be in Loading state')
    t.same(registerEventList.map(e => e.type), [
      duckula.Type.MESSAGE,
      duckula.Type.NEXT,
    ], 'should got MESSAGE event')
    t.same(registerContext().contacts, [], 'should have empty mentioned id list before onDone')

    const CONTACT_MENTION_LIST = await Promise.all(
      MENTION_LIST
        .map(c => wechatyFixture.wechaty.Contact.find({ id: c.id })),
    ) as WECHATY.Contact[]

    // console.info(proxyEventList)
    registerEventList.length = 0

    // await new Promise(r => setTimeout(r, 3))
    await sandbox.clock.runAllAsync()
    consumerEventList.forEach(e => console.info('consumer event:', e))
    t.same(
      consumerEventList,
      [
        Mailbox.Event.ACTOR_IDLE(),
        Mailbox.Event.ACTOR_REPLY(
          duckula.Event.MENTIONS(
            CONTACT_MENTION_LIST.map(c => c.payload!),
            messageEventList
              .filter(isActionOf(duckula.Event.MESSAGE))
              .at(-1)!
              .payload
              .message,
          ),
        ),
      ],
      'should have 2 events after one message with contacts list for mention message',
    )
    t.equal(registerState(), duckula.State.Idle, 'should be in idle state')
    t.same(registerEventList.map(e => e.type), [
      WechatyActor.Type.BATCH_RESPONSE,
      duckula.Type.MENTIONS,
      duckula.Type.NEXT,
      duckula.Type.NOTICE,
      duckula.Type.REPORT,
      duckula.Type.MENTIONS,
    ], 'should got BATCH_RESPONSE, MENTION, NEXT, REPORT, SEND_MESSAGE_COMMAND_RESPONSE event')
    t.same(
      Object.values(registerContext().contacts).map(c => c.id),
      MENTION_LIST.map(c =>  c.id),
      'should have mentioned id list before onDone',
    )
    consumerInterpreter.stop()
    sandbox.restore()
  }
})

test('register actor smoke testing', async t => {
  let interpreter: AnyInterpreter

  for await (const fixture of bot5Fixtures()) {

    const bus$ = CQRS.from(fixture.wechaty.wechaty)
    const wechatyMailbox = WechatyActor.from(bus$, fixture.wechaty.wechaty.puppet.id)
    wechatyMailbox.open()

    const registerMailbox = Mailbox.from(machine.withContext({
      ...duckula.initialContext(),
      actors: {
        wechaty: String(wechatyMailbox.address),
        noticing: String(Mailbox.nil.address),
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

    const eventList: AnyEventObject[] = []
    interpreter = interpret(testMachine)
      .onEvent(e => eventList.push(e))
      .start()

    bus$.pipe(
      // tap(e => console.info('### bus$', e)),
      filter(CQRS.is(CQRS.events.MessageReceivedEvent)),
      map(e => CQRS.queries.GetMessagePayloadQuery(fixture.wechaty.wechaty.puppet.id, e.payload.messageId)),
      mergeMap(CQRS.execute$(bus$)),
      map(response => response.payload.message),
      filter(removeUndefined),
      map(messagePayload => duckula.Event.MESSAGE(messagePayload)),
    ).subscribe(e => {
      // console.info('### duckula.Event.MESSAGE', e)
      interpreter.send(e)
    })

    /**
     * 1. test no-mention
     */
    eventList.length = 0
    const messageFutureNoMention = new Promise(resolve => fixture.wechaty.wechaty.once('message', resolve))
    fixture.mocker.mary.say('register').to(fixture.mocker.groupRoom)
    await messageFutureNoMention
    await new Promise(resolve => setTimeout(resolve, 0))

    // ;(registerMailbox as Mailbox.impls.Mailbox).internal.actor.interpreter!.onTransition(s => {
    //   console.info('______________________________')
    //   console.info(`Actor: (${s.history?.value}) + [${s.event.type}] = (${s.value})`)
    //   console.info('-------------------------')
    // })
    // ;(registerMailbox as Mailbox.impls.Mailbox).internal.interpreter!.onTransition(s => {
    //   console.info('______________________________')
    //   console.info(`Mailbox: (${(s.history?.value as any).child}) + [${s.event.type}] = (${(s.value as any).child})`)
    //   console.info('-------------------------')
    // })
    // ;(wechatyMailbox as Mailbox.impls.Mailbox).internal.actor.interpreter!.onTransition(s => {
    //   console.info('______________________________')
    //   // console.info(`Wechaty: (${(s.history?.value as any).child}) + [${s.event.type}] = (${(s.value as any).child}})`)
    //   console.info(`Wechaty: (${s.history?.value}) + [${s.event.type}] = (${s.value})`)
    //   console.info('-------------------------')
    // })
    // console.info('######################################')
    // await new Promise(resolve => setTimeout(resolve, 100))

    /**
     * 2. test mention
     */
    eventList.length = 0
    // const messageFutureMentions = new Promise(resolve => fixture.wechaty.wechaty.once('message', resolve))

    const CONTACT_PAYLOAD_LIST = (await fixture.wechaty.groupRoom.memberAll())
      .map(contact => contact.payload)
      .filter(removeUndefined)

    fixture.mocker.mary.say(
      'register',
      CONTACT_PAYLOAD_LIST.map(
        p => fixture.mocker.mocker.ContactMock.load(p.id),
      ),
    ).to(fixture.mocker.groupRoom)

    const mentionsFuture = new Promise(resolve =>
      interpreter.onEvent(e => {
        // console.info('event:', e)
        if (e.type === duckula.Type.MENTIONS) {
          resolve(e)
        }
      }),
    )

    const mentionsEvent = await mentionsFuture

    // console.info(eventList)
    t.same(
      mentionsEvent,
      duckula.Event.MENTIONS(
        CONTACT_PAYLOAD_LIST,
        eventList
          .filter(isActionOf(duckula.Event.MESSAGE))
          .at(-1)!
          .payload
          .message,
      ),
      'should get CONTACT events with mention list',
    )

  }

  interpreter!.stop()
})
