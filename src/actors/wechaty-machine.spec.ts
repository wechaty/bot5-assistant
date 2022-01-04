#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/* eslint-disable sort-keys */

import {
  test,
  sinon,
}                   from 'tstest'

import {
  createMachine,
  interpret,
  AnyEventObject,
  // spawn,
}                   from 'xstate'
import type * as WECHATY from 'wechaty'
import { createFixture } from 'wechaty-mocker'
import {
  Events,
  States,
  Types,
}           from '../schemas/mod.js'

import {
  wechatyMachine,
}                   from './wechaty-machine.js'
import { Mailbox } from '../mailbox/mod.js'

test('wechatyMachine transition smoke testing', async t => {
  let nextState = wechatyMachine.transition(wechatyMachine.initialState, Events.START())
  // console.info('nextState:', nextState.value)
  // console.info('nextState:', nextState.event.type)

  t.equal(nextState.value, States.idle, 'should idle after start')
  t.equal(nextState.event.type, Types.START, 'should get START event')

  const DUMMY_WECHATY = {} as any
  nextState = wechatyMachine.transition(nextState, Events.WECHATY(DUMMY_WECHATY as any))

  t.same(nextState.context, {
    wechaty: DUMMY_WECHATY,
  }, 'should have wechaty context after received WECHATY event')
  t.equal(nextState.event.type, Types.WECHATY, 'should get WECHATY event')
})

test('wechatyActor SAY with concurrency', async t => {
  const WECHATY_MACHINE_ID = 'wechaty-machine-id'

  const testActor = createMachine({
    invoke: {
      src: Mailbox.address(wechatyMachine),
      id: WECHATY_MACHINE_ID,
    },
    on: { '*': {
      actions: Mailbox.Actions.proxyToChild(WECHATY_MACHINE_ID),
    }},
  })

  for await (const WECHATY_FIXTURES of createFixture()) {
    const {
      wechaty,
      bot,
      player,
      room,
    }         = WECHATY_FIXTURES.wechaty

    const EXPECTED_TEXT = 'hello world'

    const eventList: AnyEventObject[] = []
    const interpreter = interpret(testActor)
      .onTransition(s => eventList.push(s.event))
      .start()

    interpreter.send(Events.WECHATY(wechaty))

    eventList.length = 0

    const spy = sinon.spy()
    wechaty.on('message', spy)

    interpreter.send(Events.SAY(EXPECTED_TEXT + 0, room.id, []))
    interpreter.send(Events.SAY(EXPECTED_TEXT + 1, room.id, []))
    interpreter.send(Events.SAY(EXPECTED_TEXT + 2, room.id, []))
    // eventList.forEach(e => console.info(e.type))

    /**
     * Wait async: `wechaty.puppet.messageSendText()`
     */
    await new Promise(setImmediate)
    t.equal(spy.callCount, 3, 'should emit 3 messages')
    t.equal(spy.args[1]![0].type(), wechaty.Message.Type.Text, 'should emit text message')
    t.equal(spy.args[1]![0].text(), EXPECTED_TEXT + 1, `should emit "${EXPECTED_TEXT}1"`)

    interpreter.stop()
  }
})

test('wechatyMachine interpreter smoke testing', async t => {
  const WECHATY_MACHINE_ID = 'wechaty-machine-id'

  const testMachine = createMachine({
    invoke: {
      src: wechatyMachine,
      id: WECHATY_MACHINE_ID,
    },
    on: {
      '*': {
        actions: Mailbox.Actions.proxyToChild(WECHATY_MACHINE_ID),
      },
    },
  })

  const eventList: AnyEventObject[] = []
  const interpreter = interpret(testMachine)
    .onTransition(s => eventList.push(s.event))
    .start()
  let snapshot = interpreter.getSnapshot()

  // interpreter.subscribe(s => {
  //   console.info('[new transition]')
  //   console.info('  state ->', s.value)
  //   console.info('  event ->', s.event.type)
  //   console.info('')
  // })

  for await (const WECHATY_FIXTURES of createFixture()) {
    const {
      wechaty,
      bot,
      player,
      room,
    }         = WECHATY_FIXTURES.wechaty

    interpreter.send([
      Events.WECHATY(wechaty),
    ])
    interpreter.send(
      Events.START(),
    )
    const EXPECTED_TEXT = 'hello world'
    const future = new Promise<WECHATY.Message>(resolve =>
      wechaty.once('message', resolve),
    )
    interpreter.send(
      Events.SAY(EXPECTED_TEXT, room.id, [player.id]),
    )
    const message = await future
    t.equal(message.text(), EXPECTED_TEXT, `should get said message "${EXPECTED_TEXT}"`)
  }

  interpreter.stop()
})
