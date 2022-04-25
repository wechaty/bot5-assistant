#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/* eslint-disable sort-keys */

import {
  test,
  sinon,
}                           from 'tstest'
import {
  AnyEventObject,
  interpret,
  createMachine,
  EventObject,
  // spawn,
  actions,
  StateValue,
}                           from 'xstate'
import type * as WECHATY    from 'wechaty'

import { inspect }          from '@xstate/inspect/lib/server.js'
import { WebSocketServer }  from 'ws'
import type * as Mailbox    from 'mailbox'

import { getSilkFixtures }    from '../../fixtures/get-silk-fixtures.js'

import { bot5Fixtures }     from '../../fixtures/bot5-fixture.js'

import duckula    from './duckula.js'
import machine    from './machine.js'

test('Brainstorming actor smoke testing', async t => {
  for await (
    const {
      mocker: mockerFixture,
      wechaty: wechatyFixture,
      logger,
    } of bot5Fixtures()
  ) {
    const sandbox = sinon.createSandbox({
      useFakeTimers: { now: Date.now() },
    })

    const server = new WebSocketServer({
      port: 8888,
    })

    inspect({ server })

    const FEEDBACKS = {
      [mockerFixture.mary.id]: 'im mary',
      [mockerFixture.mike.id]: 'im mike',
      [mockerFixture.player.id]: audioFixtures.silk.text,
      [mockerFixture.bot.id]: 'im bot',
    } as const

    const injector = createBot5Injector({
      wechatyStore: wechatyFixture.wechaty,
      logger,
      devTools: true,
    })

    const mailbox = injector.injectFunction(machine.mailboxFactory) as Mailbox.impls.Mailbox

    const targetEventList: EventObject[] = []
    const targetStateList: StateValue[] = []
    mailbox.debug.target.interpreter!.onTransition(s => {
      console.info('  - [TARGET]', s.value, s.event.type)
      targetEventList.push(s.event)
      targetStateList.push(s.value)
    })

    const targetSnapshot  = () => mailbox.debug.target.interpreter!.getSnapshot()
    const targetContext   = () => targetSnapshot().context as machine.Context

    const proxyMachine = createMachine<any>({
      id: 'ProxyMachine',
      on: {
        '*': {
          actions: actions.choose([
            {
              cond: mailbox.address.condNotOrigin(),
              actions: mailbox.address.send((_, e) => e),
            },
          ]),
        },
      },
    })

    const proxyEventList: AnyEventObject[] = []
    const proxyInterpreter = interpret(proxyMachine)
      .onEvent(e => proxyEventList.push(e))
      .onTransition(s => {
        console.info('  - [PROXY]:', s.value, s.event.type)
        // console.info('event:', s.event.type)
      })
      .start()

    const messageList: WECHATY.Message[] = []
    wechatyFixture.wechaty.on('message', async msg => {
      messageList.push(msg)
      console.info('  - [Wechaty] message:', String(msg))

      if (msg.self()) {
        return
      }
      proxyInterpreter.send(
        duck.Event.MESSAGE(msg),
      )
    })

    /**
     * Events.ROOM(groupRoom) - setting room
     */
    targetEventList.length = 0
    targetStateList.length = 0
    proxyInterpreter.send(duck.Event.ROOM(wechatyFixture.groupRoom))
    proxyInterpreter.send(duck.Event.REPORT())
    await sandbox.clock.runToLastAsync()
    t.equal(
      targetContext().room?.id,
      wechatyFixture.groupRoom.id,
      'should set room to context',
    )
    t.same(targetStateList, [
      duck.State.Idle,
      duck.State.reporting,
      duck.State.registering,
    ], 'should in state.{idle,reporting,registering}')

    /**
     * XState Issue #2931 - https://github.com/statelyai/xstate/issues/2931
     *  "An unexpected error has occurred" with statecharts.io/inspect #2931
     */
    // await new Promise(resolve => setTimeout(resolve, 10000))

    /**
     * Events.MESSAGE(message) - no mentions
     */
    targetStateList.length = 0
    mockerFixture.player.say('hello, no mention to anyone', []).to(mockerFixture.groupRoom)
    await sandbox.clock.runAllAsync()
    t.same(targetStateList, [duck.State.registering], 'should in state.registering if no mention')

    // console.info('eventList', eventList)

    // await new Promise(resolve => setTimeout(resolve, 5000))

    /**
     * Events.MESSAGE(message) - with mentions
     */
    targetEventList.length = 0
    proxyEventList.length = 0
    targetStateList.length = 0
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
      targetContext().contacts.map(c => c.id),
      [
        mockerFixture.mary.id,
        mockerFixture.mike.id,
        mockerFixture.player.id,
      ],
      'should set contacts to mary, mike, player',
    )
    t.same(targetStateList, [
      duck.State.registering,
      duck.State.feedbacking,
      duck.State.feedbacking,
    ], 'should transition to registering & feedbacking states')
    t.same(targetEventList.map(e => e.type), [
      duck.Type.MESSAGE,
      duck.Type.CONTACTS,
      duck.Type.NOTICE,
    ], 'should have MESSAGE,CONTACTS,NOTICE event')

    await sandbox.clock.runAllAsync()

    // console.info(targetSnapshot().context)
    // console.info(targetSnapshot().value)
    targetEventList.length = 0
    targetStateList.length = 0
    mockerFixture.mary
      .say(FEEDBACKS[mockerFixture.mary.id])
      .to(mockerFixture.groupRoom)
    await sandbox.clock.runAllAsync()
    t.same(
      targetContext().feedbacks,
      {},
      'should no feedbacks because it will updated only all members have replied',
    )
    t.same(targetStateList, [
      duck.State.feedbacking,
    ], 'should in state.feedbacking')

    targetEventList.length = 0
    targetStateList.length = 0
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
    t.same(targetStateList, [
      duck.State.feedbacking,
      duck.State.feedbacking,
      duck.State.reporting,
      duck.State.reporting,
      duck.State.Idle,
    ], 'should in state.feedbacking,reporting,idle')
    t.same(targetEventList.map(e => e.type), [
      duck.Type.MESSAGE,
      duck.Type.MESSAGE,
      duck.Type.FEEDBACKS,
      duck.Type.NOTICE,
      duck.Type.IDLE,
    ], 'should have MESSAGE,CONTACTS,NOTICE event')
    t.same(
      targetEventList.filter(e => e.type === duck.Type.FEEDBACKS),
      [
        duck.Event.FEEDBACKS({
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
