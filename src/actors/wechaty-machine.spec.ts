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
import * as Mailbox from '../mailbox/mod.js'

test('wechatyMachine transition smoke testing', async t => {
  let nextState = wechatyMachine.transition(wechatyMachine.initialState, Events.START())
  // console.info('nextState:', nextState.value)
  // console.info('nextState:', nextState.event.type)

  t.equal(nextState.value, States.inactive, 'should abort if no wechaty set before start')
  t.equal(nextState.event.type, Types.START, 'should get START event')

  nextState = wechatyMachine.transition(nextState, Events.WECHATY({} as any))

  t.equal(nextState.value, States.inactive, 'should be in inactive after received WECHATY event')
  t.equal(nextState.event.type, Types.WECHATY, 'should get WECHATY event')

  nextState = wechatyMachine.transition(nextState, Events.START())
  // console.info('nextState.actions:', nextState.actions)
  // console.info('nextState.transitions:', nextState.transitions.map(t => t.source.key))
  // console.info('nextState.historyValue:', nextState.historyValue)
  t.same(nextState.value, {
    [States.active]: States.idle,
  }, 'should be in active.idle after received START event')
  t.equal(nextState.event.type, Types.START, 'should get START event')
})

// test('wechatyActor SAY with concurrency', async t => {
//   for await (const WECHATY_FIXTURES of createFixture()) {
//     const {
//       wechaty,
//       bot,
//       player,
//       room,
//     }         = WECHATY_FIXTURES.wechaty

//     const EXPECTED_TEXT = 'hello world'
//     const eventList: AnyEventObject[] = []
//     const interpreter = interpret(wechatyActor)
//       .onTransition(s => eventList.push(s.event))
//       .start()

//     interpreter.send(Events.WECHATY(wechaty))

//     eventList.length = 0
//     interpreter.send(Events.START())

//     const spy = sinon.spy()
//     wechaty.on('message', spy)

//     interpreter.send(Events.SAY(EXPECTED_TEXT + 0, room.id, []))
//     interpreter.send(Events.SAY(EXPECTED_TEXT + 1, room.id, []))
//     interpreter.send(Events.SAY(EXPECTED_TEXT + 2, room.id, []))
//     // eventList.forEach(e => console.info(e.type))

//     /**
//      * Wait async: `wechaty.puppet.messageSendText()`
//      */
//     await new Promise(setImmediate)
//     t.equal(spy.callCount, 3, 'should emit 3 messages')
//     t.equal(spy.args[0]![0].type(), wechaty.Message.Type.Text, 'should emit text message')
//     t.equal(spy.args[0]![0].text(), EXPECTED_TEXT + 0, `should emit "${EXPECTED_TEXT}0"`)

//     interpreter.stop()
//   }
// })

test('wechatyMachine interpreter smoke testing', async t => {
  const WECHATY_MACHINE_ID = 'wechaty-machine-id'
  const proxy = {
    actions: actions.send((_, e) => e, { to: WECHATY_MACHINE_ID }),
  }

  const testMachine = createMachine({
    id: 'test',
    initial: 'testing',
    invoke: {
      src: wechatyMachine,
      id: WECHATY_MACHINE_ID,
    },
    states: {
      testing: {
        on: {
          [Types.START]: proxy,
          [Types.WECHATY]: proxy,
          [Types.SAY]: proxy,
        },
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

    interpreter.send(
      Events.START(),
    )
    snapshot = interpreter.getSnapshot()
    // console.info(snapshot.history)
    t.same(
      eventList.filter(e => e.type === Mailbox.Types.CHILD_REPLY),
      [
        Mailbox.Events.CHILD_REPLY(
          Events.ABORT('wechaty actor failed validating: aborted'),
        ),
      ],
      'should get ABORT after START event if no wechaty set',
    )

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

test('WechatyActor send ABORT event to parent', async t => {
  const WECHATY_MACHINE_ID = 'wechaty-machine-id'
  const parentMachine = createMachine({
    id: 'parent',
    invoke: {
      id: WECHATY_MACHINE_ID,
      src: wechatyMachine,
    },
    initial: 'testing',
    context: {},
    on: {
      [Types.ABORT]: {
        // actions: actions.log('ABORT'),
      },
    },
    states: {
      testing: {
        entry: actions.send(Events.START(), { to: WECHATY_MACHINE_ID }),
      },
    },
  })

  const eventList: AnyEventObject[] = []
  const interpreter = interpret(parentMachine)
    .onTransition(s => eventList.push(s.event))
    .start()

  t.same(
    eventList.filter(e => e.type === Mailbox.Types.CHILD_REPLY),
    [
      Mailbox.Events.CHILD_REPLY(Events.ABORT('wechaty actor failed validating: aborted')),
    ],
    'should receive ABORT event from child to parent',
  )
})
