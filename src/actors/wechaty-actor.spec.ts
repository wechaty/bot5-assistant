#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/* eslint-disable sort-keys */

import {
  test,
  sinon,
}                   from 'tstest'

import {
  createMachine,
  interpret,
  actions,
  // spawn,
}                   from 'xstate'
import type * as WECHATY from 'wechaty'
import { createFixture } from 'wechaty-mocker'

import {
  events,
  states,
  types,
}           from '../schemas/mod.js'

import {
  initialContext,
  wechatyActor,
}                   from './wechaty-actor.js'

test('WechatyActor transition smoke testing', async t => {
  let nextState = wechatyActor.transition(wechatyActor.initialState, events.START())
  // console.info('nextState:', nextState.value)
  // console.info('nextState:', nextState.event.type)

  t.equal(nextState.value, states.inactive, 'should abort if no wechaty set before start')
  t.equal(nextState.event.type, types.START, 'should get START event')

  nextState = wechatyActor.transition(nextState, events.WECHATY({} as any))

  t.equal(nextState.value, states.inactive, 'should be in inactive after received WECHATY event')
  t.equal(nextState.event.type, types.WECHATY, 'should get WECHATY event')

  nextState = wechatyActor.transition(nextState, events.START())
  // console.info('nextState.actions:', nextState.actions)
  // console.info('nextState.transitions:', nextState.transitions.map(t => t.source.key))
  // console.info('nextState.historyValue:', nextState.historyValue)
  t.same(nextState.value, {
    [states.active]: states.idle,
  }, 'should be in active.idle after received START event')
  t.equal(nextState.event.type, types.START, 'should get START event')
})

test.only('WechatyActor mailbox queue', async t => {
  for await (const WECHATY_FIXTURES of createFixture()) {
    const {
      wechaty,
      bot,
      player,
      room,
    }         = WECHATY_FIXTURES.wechaty

    const EXPECTED_TEXT = 'hello world'
    const interpreter = interpret(wechatyActor)
      .onTransition(s => {
        // console.info('-------')
        // console.info('transition state:', s.value)
        // console.info('transition event:', s.event.type)
        // console.info('-------')
      })
      .start()

    let snapshot = interpreter.getSnapshot()
    t.equal(snapshot.context.mailbox.queue.length, 0, 'should have a empty queue')

    interpreter.send(events.SAY(EXPECTED_TEXT + 0, room.id, []))
    interpreter.send(events.SAY(EXPECTED_TEXT + 1, room.id, []))
    interpreter.send(events.SAY(EXPECTED_TEXT + 2, room.id, []))

    snapshot = interpreter.getSnapshot()
    t.equal(snapshot.context.mailbox.queue.length, 3, 'should queue 3 events')

    interpreter.send(events.WAKEUP())
    // await new Promise(setImmediate)
    t.equal(snapshot.context.mailbox.queue.length, 3, 'should ignore WAKEUP event')

    const spy = sinon.spy()
    wechaty.on('message', spy)

    interpreter.send(events.WECHATY(wechaty))
    interpreter.send(events.START())

    /**
     * Wait async: `wechaty.puppet.messageSendText()`
     */
    await new Promise(setImmediate)
    t.equal(spy.callCount, 3, 'should emit 3 messages')
    t.equal(spy.args[0]![0].type(), wechaty.Message.Type.Text, 'should emit text message')
    t.equal(spy.args[0]![0].text(), EXPECTED_TEXT + 0, `should emit "${EXPECTED_TEXT}0"`)

    interpreter.stop()
  }
})

test('wechatyActor interpreter smoke testing', async t => {
  const interpreter = interpret(
    /**
     * Huan(202112): using `.withContext()` at here because the `context` from `wechatyActor` machine config
     *  might be changed by other unit tests
     *  and in which case can fail this test
     */
    wechatyActor.withContext(
      initialContext(),
    ),
  ).start()
  let snapshot = interpreter.getSnapshot()

  // console.info(snapshot)
  t.equal(snapshot.value, states.inactive, 'should be inactive state')
  t.same(snapshot.context.mailbox.queue, [], 'should be no events in the queue')
  t.equal(snapshot.context.mailbox.current, null, 'should be no current event')

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

    interpreter.send(
      events.START(),
    )
    snapshot = interpreter.getSnapshot()
    // console.info(snapshot.history)
    t.equal(snapshot.event.type, types.ABORT, 'should get ABORT after START event if no wechaty set')
    t.equal(snapshot.value, states.inactive, 'should be in state.inactive if no wechaty set')

    interpreter.send([
      events.WECHATY(wechaty),
    ])
    snapshot = interpreter.getSnapshot()
    t.equal(snapshot.event.type, types.WECHATY, 'should get WECHATY event')
    t.equal(snapshot.value, states.inactive, 'should be state.inactive after WECHATY event')
    t.equal(snapshot.context.wechaty, wechaty, `should have context.wechaty set to ${wechaty}`)

    interpreter.send(
      events.START(),
    )
    snapshot = interpreter.getSnapshot()
    // console.info(snapshot.history)
    t.equal(snapshot.event.type, types.START, 'should get START event')
    t.same(snapshot.value, {
      [states.active]: states.idle,
    }, 'should be in active.idle with wechaty set')
    t.equal(snapshot.context.wechaty, wechaty, `should have context.wechaty set to ${wechaty}`)

    const EXPECTED_TEXT = 'hello world'
    const future = new Promise<WECHATY.Message>(resolve => wechaty.once('message', resolve))
    interpreter.send(
      events.SAY(EXPECTED_TEXT, room.id, [player.id]),
    )
    snapshot = interpreter.getSnapshot()
    // console.info(snapshot.history)
    t.equal(snapshot.event.type, types.WAKEUP, 'should get WAKEUP event after SAY')
    t.same(snapshot.value, {
      [states.active]: states.processing,
    }, 'should be in active.processing after SAY')
    const message = await future
    t.equal(message.text(), EXPECTED_TEXT, `should get said message "${EXPECTED_TEXT}"`)
  }

  interpreter.stop()
})

test('WechatyActor send ABORT event to parent', async t => {
  const parentMachine = createMachine({
    id: 'parent',
    invoke: {
      id: 'wechaty',
      src: wechatyActor,
    },
    initial: 'start',
    context: {},
    on: {
      [types.ABORT]: {
        // actions: actions.log('ABORT'),
      },
    },
    states: {
      start: {
        entry: actions.send(events.START(), { to: 'wechaty' }),
      },
    },
  })

  const interpreter = interpret(parentMachine)
    .onTransition(s => console.info(s.event.type))
    .start()

  const snapshot = interpreter.getSnapshot()
  t.equal(snapshot.event.type, types.ABORT, 'should receive ABORT event from child to parent')
  t.equal(snapshot.value, 'start', 'should stay in start state for parent')
})
