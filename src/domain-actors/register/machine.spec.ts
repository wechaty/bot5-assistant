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
import * as Mailbox                 from 'mailbox'
import * as CQRS                    from 'wechaty-cqrs'
import { isActionOf }               from 'typesafe-actions'

import * as WechatyActor      from '../../wechaty-actor/mod.js'
import { removeUndefined }    from '../../pure-functions/remove-undefined.js'
import { bot5Fixtures }       from '../../fixtures/bot5-fixture.js'

import duckula, { Context, Events }   from './duckula.js'
import machine                        from './machine.js'

test('register machine smoke testing', async t => {
  for await (const {
    mocker: mockerFixture,
    wechaty: wechatyFixture,
  } of bot5Fixtures()) {

    const sandbox = sinon.createSandbox({
      useFakeTimers: true,
    })

    const bus$ = CQRS.from(wechatyFixture.wechaty)
    const wechatyMailbox = WechatyActor.from(bus$, wechatyFixture.wechaty.puppet.id)
    wechatyMailbox.open()

    const testMachine = createMachine({
      invoke: {
        id: duckula.id,
        src: machine.withContext({
          ...duckula.initialContext(),
          chairs: {},
          actors: {
            wechaty: String(wechatyMailbox.address),
          },
        }),
      },
      on: {
        '*': {
          actions: Mailbox.actions.proxy('testMachine')(duckula.id),
        },
      },
    })

    const testEventList: AnyEventObject[] = []
    const testInterpreter = interpret(testMachine)
    testInterpreter
      .onEvent(e => testEventList.push(e))
      .start()

    const registerInterpreter = testInterpreter.children.get(duckula.id) as Interpreter<any>
    const registerSnapshot    = () => registerInterpreter.getSnapshot()
    const registerContext     = () => registerSnapshot().context as Context
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
    testEventList.length = 0
    const messageFutureNoMention = new Promise(resolve => wechatyFixture.wechaty.once('message', resolve))

    mockerFixture.mary.say('register without mentions').to(mockerFixture.groupRoom)
    await messageFutureNoMention
    t.equal(testEventList.length, 0, 'should has no message sent to parent right after message')

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
    t.same(testEventList, [
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
    testEventList.length = 0
    registerEventList.length = 0
    const MENTION_LIST = [ mockerFixture.mike, mockerFixture.mary, mockerFixture.player ]

    const messageFutureMentions = new Promise(resolve => wechatyFixture.wechaty.once('message', resolve))
    mockerFixture.mary.say('register with mentions', MENTION_LIST).to(mockerFixture.groupRoom)
    await messageFutureMentions
    // console.info('mentionMessage:', mentionMessage.text())

    t.equal(testEventList.length, 0, 'should has no message sent to parent right after message')

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
    testEventList.forEach(e => console.info('consumer event:', e))
    t.same(
      testEventList,
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
      Mailbox.Type.ACTOR_IDLE,
      duckula.Type.MENTIONS,
    ], 'should got BATCH_RESPONSE, MENTION, NEXT, REPORT, ACTOR_IDLE, MENTIONS event')
    t.same(
      Object.values(registerContext().contacts).map(c => c.id),
      MENTION_LIST.map(c =>  c.id),
      'should have mentioned id list before onDone',
    )
    testInterpreter.stop()
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
      chairs: {},
      actors: {
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
