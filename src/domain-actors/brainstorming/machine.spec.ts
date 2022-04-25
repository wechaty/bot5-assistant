#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/* eslint-disable sort-keys */

import {
  AnyEventObject,
  interpret,
  createMachine,
  EventObject,
  StateValue,
}                           from 'xstate'
import { map, mergeMap, filter } from 'rxjs/operators'
import { test, sinon }      from 'tstest'
import * as CQRS            from 'wechaty-cqrs'
import { inspect }          from '@xstate/inspect/lib/server.js'
import { WebSocketServer }  from 'ws'
import * as Mailbox         from 'mailbox'

import * as WechatyActor      from '../../wechaty-actor/mod.js'
import { getSilkFixtures }    from '../../fixtures/get-silk-fixtures.js'
import { bot5Fixtures }       from '../../fixtures/bot5-fixture.js'
import { removeUndefined }    from '../../pure-functions/remove-undefined.js'

import * as RegisterDuckula   from '../register/mod.js'
import * as FeedbackDuckula   from '../feedback/mod.js'

import duckula, { Context }   from './duckula.js'
import machine                from './machine.js'

test('Brainstorming actor smoke testing', async t => {
  for await (
    const {
      mocker: mockerFixture,
      wechaty: wechatyFixture,
    } of bot5Fixtures()
  ) {
    const sandbox = sinon.createSandbox({
      useFakeTimers: { now: Date.now() },
    })

    const bus$ = CQRS.from(wechatyFixture.wechaty)
    const wechatyActor = WechatyActor.from(bus$, wechatyFixture.wechaty.puppet.id)

    const server = new WebSocketServer({
      port: 8888,
    })

    inspect({ server })

    const SILK = await getSilkFixtures()

    const FEEDBACKS = {
      [mockerFixture.mary.id]: 'im mary',
      [mockerFixture.mike.id]: 'im mike',
      [mockerFixture.player.id]: SILK.text,
      [mockerFixture.bot.id]: 'im bot',
    } as const

    const registerActor = Mailbox.from(RegisterDuckula.machine.withContext({
      ...RegisterDuckula.initialContext(),
      address: {
        wechaty: String(wechatyActor.address),
        noticing: String(Mailbox.nil.address),
      },
    }))
    registerActor.open()

    const feedbackActor = Mailbox.from(FeedbackDuckula.machine.withContext({
      ...FeedbackDuckula.initialContext(),
      address: {
        wechaty: String(wechatyActor.address),
        noticing: String(Mailbox.nil.address),
        register: String(registerActor.address),
      },
    }))
    feedbackActor.open()

    const actor = Mailbox.from(machine.withContext({
      ...duckula.initialContext(),
      address: {
        wechaty  : String(wechatyActor.address),
        feedback : String(feedbackActor.address),
        register : String(registerActor.address),
        noticing : String(Mailbox.nil.address),
      },
    }))
    actor.open()

    const actorEventList: EventObject[] = []
    const actorStateList: StateValue[] = []
    ;(actor as Mailbox.impls.Mailbox).internal.actor.interpreter!.subscribe(s => {
      actorEventList.push(s.event)
      actorStateList.push(s.value)

      console.info(`>>> ${s.machine?.id}:`, [
        `(${s.history?.value || ''})`.padEnd(30, ' '),
        ' + ',
        `[${s.event.type}]`.padEnd(30, ' '),
        ' = ',
        `(${s.value})`.padEnd(30, ' '),
      ].join(''))
    })

    const targetSnapshot  = () => (actor as Mailbox.impls.Mailbox).internal.actor.interpreter!.getSnapshot()
    const targetContext   = () => targetSnapshot().context as Context

    const testMachine = createMachine<any>({
      id: 'TestMachine',
      on: {
        '*': {
          actions: Mailbox.actions.proxy('TestMachine')(actor),
        },
      },
    })

    const testEventList: AnyEventObject[] = []
    const testInterpreter = interpret(testMachine)
      .onEvent(e => {
        testEventList.push(e)
        console.info('<<<', testMachine.id, ':', `[${e.type}]`)
      })
      .start()

    const messageList: ReturnType<typeof duckula.Event.MESSAGE>[] = []

    bus$.pipe(
      // tap(e => console.info('### bus$', e)),
      filter(CQRS.is(CQRS.events.MessageReceivedEvent)),
      map(e => CQRS.queries.GetMessagePayloadQuery(wechatyFixture.wechaty.puppet.id, e.payload.messageId)),
      mergeMap(CQRS.execute$(bus$)),
      map(response => response.payload.message),
      filter(removeUndefined),
      map(messagePayload => duckula.Event.MESSAGE(messagePayload)),
    ).subscribe(e => {
      console.info('### duckula.Event.MESSAGE', e)
      messageList.push(e)
      testInterpreter.send(e)
    })

    /**
     * Events.ROOM(groupRoom) - setting room
     */
    actorEventList.length = 0
    actorStateList.length = 0
    testInterpreter.send(duckula.Event.ROOM(wechatyFixture.groupRoom.payload!))
    testInterpreter.send(duckula.Event.REPORT())
    await sandbox.clock.runToLastAsync()
    t.equal(
      targetContext().room?.id,
      wechatyFixture.groupRoom.id,
      'should set room to context',
    )
    t.same(actorStateList, [
      duckula.State.Idle,
      duckula.State.Reporting,
      duckula.State.Registering,
    ], 'should in state.{idle,reporting,registering}')

    /**
     * XState Issue #2931 - https://github.com/statelyai/xstate/issues/2931
     *  "An unexpected error has occurred" with statecharts.io/inspect #2931
     */
    // await new Promise(resolve => setTimeout(resolve, 10000))

    /**
     * Events.MESSAGE(message) - no mentions
     */
    actorStateList.length = 0
    mockerFixture.player.say('hello, no mention to anyone').to(mockerFixture.groupRoom)
    await sandbox.clock.runAllAsync()
    t.same(actorStateList, [ duckula.State.Registering ], 'should in state.registering if no mention')

    // console.info('eventList', eventList)

    // await new Promise(resolve => setTimeout(resolve, 5000))

    /**
     * Events.MESSAGE(message) - with mentions
     */
    actorEventList.length = 0
    actorStateList.length = 0
    testEventList.length = 0
    mockerFixture.player
      .say('register mary & mike & player by mention them', [
        mockerFixture.mary,
        mockerFixture.mike,
        mockerFixture.player,
      ])
      .to(mockerFixture.groupRoom)
    await sandbox.clock.runAllAsync()
    // console.info('targetStateList', targetStateList)
    // console.info('proxyEventList', proxyEventList)
    t.same(
      Object.values(targetContext().contacts)
        .map(c => c.id),
      [
        mockerFixture.mary.id,
        mockerFixture.mike.id,
        mockerFixture.player.id,
      ],
      'should set contacts to mary, mike, player',
    )
    t.same(actorStateList, [
      duckula.State.Registering,
      duckula.State.Feedbacking,
      duckula.State.Feedbacking,
    ], 'should transition to registering & feedbacking states')
    t.same(actorEventList.map(e => e.type), [
      duckula.Type.MESSAGE,
      duckula.Type.CONTACTS,
      duckula.Type.NOTICE,
    ], 'should have MESSAGE,CONTACTS,NOTICE event')

    await sandbox.clock.runAllAsync()

    // console.info(targetSnapshot().context)
    // console.info(targetSnapshot().value)
    actorEventList.length = 0
    actorStateList.length = 0
    mockerFixture.mary
      .say(FEEDBACKS[mockerFixture.mary.id])
      .to(mockerFixture.groupRoom)
    await sandbox.clock.runAllAsync()
    t.same(
      targetContext().feedbacks,
      {},
      'should no feedbacks because it will updated only all members have replied',
    )
    t.same(actorStateList, [
      duckula.State.Feedbacking,
    ], 'should in state.Feedbacking')

    actorEventList.length = 0
    actorStateList.length = 0
    mockerFixture.mike
      .say(FEEDBACKS[mockerFixture.mike.id])
      .to(mockerFixture.groupRoom)
    mockerFixture.player
      .say(FEEDBACKS[mockerFixture.player.id])
      .to(mockerFixture.groupRoom)
    await sandbox.clock.runAllAsync()
    t.same(
      targetContext().feedbacks,
      {
        [mockerFixture.mary.id]: FEEDBACKS[mockerFixture.mary.id],
        [mockerFixture.mike.id]: FEEDBACKS[mockerFixture.mike.id],
        [mockerFixture.player.id]: FEEDBACKS[mockerFixture.player.id],
      },
      'should set feedbacks because all members have replied',
    )
    t.same(actorStateList, [
      duckula.State.Feedbacking,
      duckula.State.Feedbacking,
      duckula.State.Reporting,
      duckula.State.Reporting,
      duckula.State.Idle,
    ], 'should in state.Feedbacking,reporting,idle')
    t.same(actorEventList.map(e => e.type), [
      duckula.Type.MESSAGE,
      duckula.Type.MESSAGE,
      duckula.Type.FEEDBACKS,
      duckula.Type.NOTICE,
      duckula.Type.IDLE,
    ], 'should have MESSAGE,CONTACTS,NOTICE event')
    t.same(
      actorEventList.filter(e => e.type === duckula.Type.FEEDBACKS),
      [
        duckula.Event.FEEDBACKS({
          [mockerFixture.mary.id]: FEEDBACKS[mockerFixture.mary.id]!,
          [mockerFixture.mike.id]: FEEDBACKS[mockerFixture.mike.id]!,
          [mockerFixture.player.id]: FEEDBACKS[mockerFixture.player.id]!,
        }),
      ],
      'should have FEEDBACKS event with feedbacks',
    )

    // console.info('Room message log:')
    // for (const msg of messageList) {
    //   const mentionText = (await msg.mentionList())
    //     .map(c => '@' + c.name()).join(' ')

    //   console.info(
    //     '-------\n',
    //     msg.talker().name(),
    //     ':',
    //     mentionText,
    //     msg.text(),
    //   )
    // }

    await sandbox.clock.runAllAsync()
    sandbox.restore()
    server.close()
  }
})
