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
import { of }                       from 'rxjs'
import { map, mergeMap, filter, tap }    from 'rxjs/operators'
import { test, sinon }              from 'tstest'
import type * as WECHATY            from 'wechaty'
import * as Mailbox                 from 'mailbox'
import * as CQRS                    from 'wechaty-cqrs'

import * as WechatyActor      from '../../wechaty-actor/mod.js'
import { removeUndefined }    from '../../pure-functions/remove-undefined.js'
import { bot5Fixtures }       from '../../fixtures/bot5-fixture.js'

import * as Notice    from '../notice/mod.js'

import duckula, { Context, Events }   from './duckula.js'
import machine                        from './machine.js'
import { invokeId } from '../../actor-utils/invoke-id.js'

test('register machine smoke testing', async t => {
  for await (const {
    mocker: mockerFixture,
    wechaty: wechatyFixture,
  } of bot5Fixtures()) {

    const sandbox = sinon.createSandbox({
      useFakeTimers: true,
    })

    wechatyFixture.wechaty.on('message', msg => console.info('[Wechaty]', String(msg)))

    const bus$ = CQRS.from(wechatyFixture.wechaty)
    const wechatyMailbox = WechatyActor.from(bus$, wechatyFixture.wechaty.puppet.id)
    wechatyMailbox.open()

    const noticeMailbox = Mailbox.from(Notice.machine.withContext({
      ...Notice.initialContext(),
      conversation: wechatyFixture.groupRoom.id,
      actors: {
        wechaty: String(wechatyMailbox.address),
      },
    }))
    noticeMailbox.open()

    const TEST_ID = 'Test'

    const testMachine = createMachine({
      id: TEST_ID,
      invoke: {
        id: invokeId(duckula.id, TEST_ID),
        src: machine.withContext({
          ...duckula.initialContext(),
          actors: {
            wechaty: String(wechatyMailbox.address),
            notice: String(noticeMailbox.address),
          },
        }),
      },
      on: {
        '*': {
          actions: Mailbox.actions.proxy(TEST_ID)(invokeId(duckula.id, TEST_ID)),
        },
      },
    })

    const testEventList: AnyEventObject[] = []
    const testInterpreter = interpret(testMachine)
    testInterpreter
      .onEvent(e => testEventList.push(e))
      .start()

    /**
     * Skip self message
     */
    of(CQRS.queries.GetCurrentUserIdQuery(wechatyFixture.wechaty.puppet.id)).pipe(
      mergeMap(CQRS.execute$(bus$)),
      map(response => response.payload.contactId),
      mergeMap(currentUserId => bus$.pipe(
        filter(CQRS.is(CQRS.events.MessageReceivedEvent)),
        map(e => CQRS.queries.GetMessagePayloadQuery(wechatyFixture.wechaty.puppet.id, e.payload.messageId)),
        mergeMap(CQRS.execute$(bus$)),
        map(response => response.payload.message),
        filter(removeUndefined),
        filter(message => message.talkerId !== currentUserId),
        map(messagePayload => duckula.Event.MESSAGE(messagePayload)),
      )),
    ).subscribe(e => {
      console.info('### duckula.Event.MESSAGE', e)
      testInterpreter.send(e)
    })

    const registerInterpreter = testInterpreter.children.get(invokeId(duckula.id, TEST_ID)) as Interpreter<any>
    const registerSnapshot    = () => registerInterpreter.getSnapshot()
    const registerContext     = () => registerSnapshot().context as Context
    const registerState       = () => registerSnapshot().value   as typeof duckula.State

    const registerEventList: AnyEventObject[] = []
    registerInterpreter.onTransition(state => {
      console.info('### registerInterpreter.onTransition', state.value, state.event.type)
      registerEventList.push(state.event)
    })

    t.equal(registerState(), duckula.State.Idle, 'should be idle state')
    t.same(registerContext().attendees, [], 'should be empty attendees list')

    testInterpreter.send(duckula.Event.REPORT())
    await sandbox.clock.runAllAsync()

    t.equal(registerState(), duckula.State.RegisteringChairs, 'should be Stae.RegisteringChairs')
    t.same(registerContext().chairs, {}, 'should have no chairs')
    t.same(registerContext().attendees, {}, 'should have no attendees')
    t.same(registerContext().talks, {}, 'should have no talks')

    t.same(registerEventList.map(e => e.type), [
      duckula.Type.NOTICE,
      duckula.Type.REPORT,
      duckula.Type.VALIDATE,
      duckula.Type.HELP,
      duckula.Type.NOTICE,
    ], 'should receive bunch of events after send REPORT')

    /**
     * Process a message without mention
     */
    testEventList.length = 0
    registerEventList.length = 0
    mockerFixture.mary.say('register without mentions').to(mockerFixture.groupRoom)
    await sandbox.clock.runAllAsync()

    t.equal(registerState(), duckula.State.RegisteringChairs, 'should be in State.RegisteringChairs')
    t.same(registerEventList.map(e => e.type), [
      duckula.Type.MESSAGE,
      duckula.Type.NO_MENTION,
      duckula.Type.INTENTS,
    ], 'should have bunch of events after received a message in the room without mention')
    t.same(registerContext().chairs, {}, 'should have empty chairs')

    t.same(registerEventList.map(e => e.type), [
      duckula.Type.MESSAGE,
      duckula.Type.NO_MENTION,
      duckula.Type.INTENTS,
    ], 'should has bunch of events after process the non-mention message in room')
    t.same(registerContext().attendees, [], 'should have empty mentioned id list before onDone')
    t.equal(registerState(), duckula.State.RegisteringChairs, 'should be in State.RegisteringChairs')

    /**
     * Chair: process a message with mention to register
     */
    testEventList.length = 0
    registerEventList.length = 0
    const CHAIR_MENTION_LIST = [ mockerFixture.player ]

    mockerFixture.mary.say('register chair with mentions', CHAIR_MENTION_LIST).to(mockerFixture.groupRoom)
    await sandbox.clock.runAllAsync()
    // console.info('mentionMessage:', mentionMessage.text())

    t.equal(registerState(), duckula.State.RegisteringChairs, 'should be in State.RegisteringChairs')
    t.same(registerEventList.map(e => e.type), [
      duckula.Type.MESSAGE,
      duckula.Type.MENTIONS,
      duckula.Type.NOTICE,
      duckula.Type.INTENTS,
    ], 'should got bunch of events after process the mention message in room for registering chair')
    t.same(registerContext().chairs, { [mockerFixture.player.id]: mockerFixture.player.payload }, 'should have one chair')

    /**
     * Vice Chair: process a message with mention to register
     */
    testEventList.length = 0
    registerEventList.length = 0
    const VICE_CHAIR_MENTION_LIST = [ mockerFixture.mike ]

    mockerFixture.mary.say('register vice chair with mentions', VICE_CHAIR_MENTION_LIST).to(mockerFixture.groupRoom)
    await sandbox.clock.runAllAsync()
    // console.info('mentionMessage:', mentionMessage.text())

    t.equal(registerState(), duckula.State.RegisteringChairs, 'should still be in State.RegisteringChairs')
    t.same(registerEventList.map(e => e.type), [
      duckula.Type.MESSAGE,
      duckula.Type.MENTIONS,
      duckula.Type.NOTICE,
      duckula.Type.INTENTS,
    ], 'should got bunch of events after process the mention message in room for registering vice chair')
    t.same(registerContext().chairs, {
      [mockerFixture.player.id]: mockerFixture.player.payload,
      [mockerFixture.mike.id]: mockerFixture.mike.payload,
    }, 'should have two chair')

    /**
     * Registered Chair: process a message with NEXT
     */
    testEventList.length = 0
    registerEventList.length = 0
    mockerFixture.mary.say('/Next').to(mockerFixture.groupRoom)
    await sandbox.clock.runAllAsync()
    t.same(registerEventList.map(e => e.type), [
      duckula.Type.MESSAGE,
      duckula.Type.NO_MENTION,
      duckula.Type.INTENTS,
      duckula.Type.VALIDATE,
      duckula.Type.NOTICE,
      duckula.Type.NEXT,
      duckula.Type.VALIDATE,
      duckula.Type.HELP,
      duckula.Type.NOTICE,
    ], 'should got bunch of events after process from registering chair to talks')
    t.equal(registerState(), duckula.State.RegisteringTalks, 'should next to State.RegisteringTalks')

    /**
     * Talks
     */
    t.same(registerContext().talks, {}, 'should have no talks')

    /**
     * Talk 1: process a message with mention to register talk
     */
    testEventList.length = 0
    registerEventList.length = 0
    const TALK1_MENTION_LIST = [ mockerFixture.player ]
    const TALK1_TEXT = 'register talk1: topic... outlines... '
    mockerFixture.mary.say(TALK1_TEXT, TALK1_MENTION_LIST).to(mockerFixture.groupRoom)
    await sandbox.clock.runAllAsync()

    t.equal(registerState(), duckula.State.RegisteringTalks, 'should be in State.RegisteringTalks')
    t.same(registerEventList.map(e => e.type), [
      duckula.Type.MESSAGE,
      duckula.Type.MENTIONS,
      duckula.Type.NOTICE,
      duckula.Type.INTENTS,
    ], 'should got bunch of events after process the mention message in room for registering talk1')
    t.same(registerContext().talks, { [mockerFixture.player.id]: TALK1_TEXT }, 'should have one talk')

    /**
     * Talk 2: process a message with mention to register
     */
    testEventList.length = 0
    registerEventList.length = 0
    const TALK2_MENTION_LIST = [ mockerFixture.mike ]
    const TALK2_TEXT = 'register talk2: topic ... outlines ...'
    mockerFixture.mary.say(TALK2_TEXT, TALK2_MENTION_LIST).to(mockerFixture.groupRoom)
    await sandbox.clock.runAllAsync()

    t.equal(registerState(), duckula.State.RegisteringTalks, 'should still be in State.RegisteringTalks')
    t.same(registerEventList.map(e => e.type), [
      duckula.Type.MESSAGE,
      duckula.Type.MENTIONS,
      duckula.Type.NOTICE,
      duckula.Type.INTENTS,
    ], 'should got bunch of events after process the mention message in room for registering talk2')
    t.same(registerContext().talks, {
      [mockerFixture.player.id]: TALK1_TEXT,
      [mockerFixture.mike.id]: TALK2_TEXT,
    }, 'should have two talks')

    /**
     * Registered Talks: process a message with NEXT
     */
    testEventList.length = 0
    registerEventList.length = 0
    mockerFixture.mary.say('/Next').to(mockerFixture.groupRoom)
    await sandbox.clock.runAllAsync()
    t.same(registerEventList.map(e => e.type), [
      duckula.Type.MESSAGE,
      duckula.Type.NO_MENTION,
      duckula.Type.INTENTS,
      duckula.Type.VALIDATE,
      duckula.Type.NOTICE,
      duckula.Type.NEXT,
      duckula.Type.VALIDATE,
      duckula.Type.HELP,
      duckula.Type.NOTICE,
    ], 'should got bunch of events after process from registering talks to attendees')
    t.equal(registerState(), duckula.State.RegisteringAttendees, 'should next to State.RegisteringAttendees')

    /**
     * Attendees: register attendees by mention them
     */
    testEventList.length = 0
    registerEventList.length = 0
    mockerFixture.mary.say('register without mentions').to(mockerFixture.groupRoom)
    await sandbox.clock.runAllAsync()

    t.equal(registerState(), duckula.State.RegisteringAttendees, 'should be in State.RegisteringAttendees')
    t.same(registerEventList.map(e => e.type), [
      duckula.Type.MESSAGE,
      duckula.Type.NO_MENTION,
      duckula.Type.HELP,
      duckula.Type.NOTICE,
      duckula.Type.INTENTS,
    ], 'should have bunch of events after received a register attendee message in the room without mention')
    t.same(registerContext().attendees, {}, 'should have empty attendees')

    /**
     * Attendee 1: process a message with mention to register
     */
    testEventList.length = 0
    registerEventList.length = 0
    const ATTENDEE1_MENTION_LIST = [ mockerFixture.mike ]

    mockerFixture.mary.say('register mike with mentions', ATTENDEE1_MENTION_LIST).to(mockerFixture.groupRoom)
    await sandbox.clock.runAllAsync()

    t.same(registerEventList.map(e => e.type), [
      duckula.Type.MESSAGE,
      duckula.Type.MENTIONS,
      duckula.Type.NOTICE,
      duckula.Type.INTENTS,
    ], 'should got bunch of events after process the mention message in room for registering attendee 1')
    t.same(registerContext().attendees, { [mockerFixture.mike.id]: mockerFixture.mike.payload }, 'should have one attendee mike')

    /**
     * Attendee 2: process a message with mention to register
     */
    testEventList.length = 0
    registerEventList.length = 0
    const ATTENDEE2_MENTION_LIST = [ mockerFixture.mary ]

    mockerFixture.player.say('register mary with mentions', ATTENDEE2_MENTION_LIST).to(mockerFixture.groupRoom)
    await sandbox.clock.runAllAsync()

    t.same(registerEventList.map(e => e.type), [
      duckula.Type.MESSAGE,
      duckula.Type.MENTIONS,
      duckula.Type.NOTICE,
      duckula.Type.INTENTS,
    ], 'should got bunch of events after process the mention message in room for registering attendee 2')
    t.same(registerContext().attendees, {
      [mockerFixture.mary.id]: mockerFixture.mary.payload,
      [mockerFixture.mike.id]: mockerFixture.mike.payload,
    }, 'should have two attendees')

    /**
     * Registered Attendees: process a message with NEXT
     */
    testEventList.length = 0
    registerEventList.length = 0
    mockerFixture.mary.say('/Next').to(mockerFixture.groupRoom)
    await sandbox.clock.runAllAsync()
    t.same(registerEventList.map(e => e.type), [
      duckula.Type.MESSAGE,
      duckula.Type.NO_MENTION,
      duckula.Type.HELP,
      duckula.Type.NOTICE,
      duckula.Type.INTENTS,
      duckula.Type.VALIDATE,
      duckula.Type.NOTICE,
      duckula.Type.NEXT,
      duckula.Type.NOTICE,
      duckula.Type.NEXT,
    ], 'should got bunch of events after process from registering attendees')
    t.equal(registerState(), duckula.State.Idle, 'should next to State.Idle')

    /**
     * Response CHAIRS, ATTENDEES, TALKS
     */
    testEventList.forEach(e => console.info(e))
    // /**
    //  * Process a message with mention
    //  */
    // testEventList.length = 0
    // registerEventList.length = 0
    // const MENTION_LIST = [ mockerFixture.mike, mockerFixture.mary, mockerFixture.player ]

    // const messageFutureMentions = new Promise(resolve => wechatyFixture.wechaty.once('message', resolve))
    // mockerFixture.mary.say('register with mentions', MENTION_LIST).to(mockerFixture.groupRoom)
    // await messageFutureMentions
    // // console.info('mentionMessage:', mentionMessage.text())

    // t.equal(testEventList.length, 0, 'should has no message sent to parent right after message')

    // t.equal(registerState(), duckula.State.Loading, 'should be in Loading state')
    // t.same(registerEventList.map(e => e.type), [
    //   duckula.Type.MESSAGE,
    //   duckula.Type.NEXT,
    // ], 'should got MESSAGE event')
    // t.same(registerContext().contacts, [], 'should have empty mentioned id list before onDone')

//     const CONTACT_MENTION_LIST = await Promise.all(
//       MENTION_LIST
//         .map(c => wechatyFixture.wechaty.Contact.find({ id: c.id })),
//     ) as WECHATY.Contact[]

//     // console.info(proxyEventList)
//     registerEventList.length = 0

//     // await new Promise(r => setTimeout(r, 3))
//     await sandbox.clock.runAllAsync()
//     testEventList.forEach(e => console.info('consumer event:', e))
//     t.same(
//       testEventList,
//       [
//         Mailbox.Event.ACTOR_IDLE(),
//         Mailbox.Event.ACTOR_REPLY(
//           duckula.Event.CONTACTS(
//             CONTACT_MENTION_LIST.map(c => c.payload!),
//           ),
//         ),
//       ],
//       'should have 2 events after one message with contacts list for mention message',
//     )
//     t.equal(registerState(), duckula.State.Idle, 'should be in idle state')
//     t.same(registerEventList.map(e => e.type), [
//       WechatyActor.Type.BATCH_RESPONSE,
//       duckula.Type.CONTACTS,
//       duckula.Type.NEXT,
//       duckula.Type.NOTICE,
//       duckula.Type.REPORT,
//       Mailbox.Type.ACTOR_IDLE,
//       duckula.Type.CONTACTS,
//     ], 'should got BATCH_RESPONSE, MENTION, NEXT, REPORT, ACTOR_IDLE, MENTIONS event')
//     t.same(
//       Object.values(registerContext().contacts).map(c => c.id),
//       MENTION_LIST.map(c =>  c.id),
//       'should have mentioned id list before onDone',
//     )
//     testInterpreter.stop()
//     sandbox.restore()
//   }
// })

// test('register actor smoke testing', async t => {
//   let interpreter: AnyInterpreter

//   for await (const fixture of bot5Fixtures()) {

//     const bus$ = CQRS.from(fixture.wechaty.wechaty)
//     const wechatyMailbox = WechatyActor.from(bus$, fixture.wechaty.wechaty.puppet.id)
//     wechatyMailbox.open()

//     const registerMailbox = Mailbox.from(machine.withContext({
//       ...duckula.initialContext(),
//       chairs: {},
//       actors: {
//         wechaty: String(wechatyMailbox.address),
//       },
//     }))
//     registerMailbox.open()

//     const testMachine = createMachine({
//       on: {
//         '*': {
//           actions: Mailbox.actions.proxy('TestMachine')(registerMailbox),
//         },
//       },
//     })

//     const eventList: AnyEventObject[] = []
//     interpreter = interpret(testMachine)
//       .onEvent(e => eventList.push(e))
//       .start()

//     bus$.pipe(
//       // tap(e => console.info('### bus$', e)),
//       filter(CQRS.is(CQRS.events.MessageReceivedEvent)),
//       map(e => CQRS.queries.GetMessagePayloadQuery(fixture.wechaty.wechaty.puppet.id, e.payload.messageId)),
//       mergeMap(CQRS.execute$(bus$)),
//       map(response => response.payload.message),
//       filter(removeUndefined),
//       map(messagePayload => duckula.Event.MESSAGE(messagePayload)),
//     ).subscribe(e => {
//       // console.info('### duckula.Event.MESSAGE', e)
//       interpreter.send(e)
//     })

//     /**
//      * 1. test no-mention
//      */
//     eventList.length = 0
//     const messageFutureNoMention = new Promise(resolve => fixture.wechaty.wechaty.once('message', resolve))
//     fixture.mocker.mary.say('register').to(fixture.mocker.groupRoom)
//     await messageFutureNoMention
//     await new Promise(resolve => setTimeout(resolve, 0))

//     // ;(registerMailbox as Mailbox.impls.Mailbox).internal.actor.interpreter!.onTransition(s => {
//     //   console.info('______________________________')
//     //   console.info(`Actor: (${s.history?.value}) + [${s.event.type}] = (${s.value})`)
//     //   console.info('-------------------------')
//     // })
//     // ;(registerMailbox as Mailbox.impls.Mailbox).internal.interpreter!.onTransition(s => {
//     //   console.info('______________________________')
//     //   console.info(`Mailbox: (${(s.history?.value as any).child}) + [${s.event.type}] = (${(s.value as any).child})`)
//     //   console.info('-------------------------')
//     // })
//     // ;(wechatyMailbox as Mailbox.impls.Mailbox).internal.actor.interpreter!.onTransition(s => {
//     //   console.info('______________________________')
//     //   // console.info(`Wechaty: (${(s.history?.value as any).child}) + [${s.event.type}] = (${(s.value as any).child}})`)
//     //   console.info(`Wechaty: (${s.history?.value}) + [${s.event.type}] = (${s.value})`)
//     //   console.info('-------------------------')
//     // })
//     // console.info('######################################')
//     // await new Promise(resolve => setTimeout(resolve, 100))

//     /**
//      * 2. test mention
//      */
//     eventList.length = 0
//     // const messageFutureMentions = new Promise(resolve => fixture.wechaty.wechaty.once('message', resolve))

//     const CONTACT_PAYLOAD_LIST = (await fixture.wechaty.groupRoom.memberAll())
//       .map(contact => contact.payload)
//       .filter(removeUndefined)

//     fixture.mocker.mary.say(
//       'register',
//       CONTACT_PAYLOAD_LIST.map(
//         p => fixture.mocker.mocker.ContactMock.load(p.id),
//       ),
//     ).to(fixture.mocker.groupRoom)

//     const mentionsFuture = new Promise(resolve =>
//       interpreter.onEvent(e => {
//         // console.info('event:', e)
//         if (e.type === duckula.Type.CONTACTS) {
//           resolve(e)
//         }
//       }),
//     )

//     const mentionsEvent = await mentionsFuture

//     // console.info(eventList)
//     t.same(
//       mentionsEvent,
//       duckula.Event.CONTACTS(CONTACT_PAYLOAD_LIST),
//       'should get CONTACT events with mention list',
//     )

    sandbox.restore()
    testInterpreter.stop()
  }

})
