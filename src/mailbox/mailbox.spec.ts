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
  spawn,
  StateFrom,
  ContextFrom,
}                   from 'xstate'
import { createFixture } from 'wechaty-mocker'

import * as mailbox from './mailbox.js'
import type { Model } from 'xstate/lib/model.types'

const MAX_DELAY = 15 * 1000

interface ChildContext { ms?: number }
type ChildEvent = { type: 'sleep', ms: number }

const childMachine = createMachine<ChildContext, ChildEvent, any>({
  id: 'child',
  context: {},
  initial: 'awake',
  states: {
    awake: {
      entry: [
        actions.log('states.awake.entry', 'ChildTest'),
        actions.sendParent(mailbox.events.IDLE()),
      ],
      on: {
        sleep: {
          target: 'sleeping',
          actions: [
            actions.log((_, e) => `states.awake.on.sleep.actions ${JSON.stringify(e)}`, 'ChildTest'),
          ],
        },
      },
      exit: [
        actions.log('states.awake.exit', 'ChildTest'),
      ],
    },
    sleeping: {
      entry: [
        actions.log((_, e) => `states.sleeping.entry ${JSON.stringify(e)}`, 'ChildTest'),
        actions.assign({ ms: (_, e) => e.ms }),
      ],
      after: {
        sleep: 'awake',
      },
      exit: [
        actions.log(_ => 'states.sleeping.exit', 'ChildTest'),
        actions.assign({ ms: _ => undefined }),
      ],
    },
  },
}, {
  delays: {
    sleep: ctx => {
      console.info('ChildTest ctx.ms:', ctx.ms)
      return ctx.ms || 0
    },
  },
})

test('childMachine smoke testing with sleeping under mock clock', async t => {
  const sandbox = sinon.createSandbox({
    useFakeTimers: true,
  })

  const parentMachine = createMachine({
    id: 'parent',
    initial: 'testing',
    invoke: {
      id: 'child',
      src: childMachine,
      autoForward: true,
    },
    states: {
      testing: {},
    },
  })

  const interpreter = interpret(parentMachine)

  // interpreter.onTransition(s => {
  //   console.info('onTransition: ')
  //   console.info('  - states:', s.value)
  //   console.info('  - event:', s.event.type)
  //   console.info()
  // })

  interpreter.start()

  const getChildSnapshot: () => StateFrom<typeof childMachine> = () => interpreter.getSnapshot.call(
    interpreter.getSnapshot().children['child'],
  ) as any

  let snapshot = getChildSnapshot()
  t.equal(snapshot.value, 'awake', 'childMachine initial state should be awake')

  interpreter.send({ type: 'sleep', ms: 10 })
  snapshot = getChildSnapshot()
  t.equal(snapshot.value, 'sleeping', 'childMachine state should be sleeping')
  t.equal(snapshot.context.ms, 10, 'childMachine context.ms should be 10')

  interpreter.send({ type: 'sleep', ms: 100000 })
  snapshot = getChildSnapshot()
  t.equal(snapshot.value, 'sleeping', 'childMachine state should be sleeping')
  t.equal(snapshot.context.ms, 10, 'childMachine context.ms should be 10 (20 has been dropped)')

  await sandbox.clock.tickAsync(9)
  snapshot = getChildSnapshot()
  t.equal(snapshot.value, 'sleeping', 'childMachine state should be sleeping after 9 ms')
  t.equal(snapshot.context.ms, 10, 'childMachine context.ms should be 10 (20 has been dropped) after 9 ms')

  await sandbox.clock.tickAsync(1)
  snapshot = getChildSnapshot()
  t.equal(snapshot.value, 'awake', 'childMachine state should be awake after 10 ms')
  t.equal(snapshot.context.ms, undefined, 'childMachine context.ms should be cleared after 10 ms')

  sandbox.restore()
})

test('mailbox wrapped actor transition nextState smoke testing', async t => {
  const actor = mailbox.wrap(childMachine)

  // console.info('initialState:', actor.initialState)

  const SLEEP_EVENT = {
    type: 'sleep',
    ms: 10,
  } as const

  let nextState = actor.transition(actor.initialState, SLEEP_EVENT)
  t.ok(nextState.actions.some(a => {
    return a.type === 'xstate.send' && a['event'].type === mailbox.types.DISPATCH
  }), 'should have triggered DISPATCH event by sending IDLE event')

  nextState = actor.transition(nextState, SLEEP_EVENT)
  t.equal(nextState.context.queue.length, 2, 'should have 2 event in queue after sent two SLEEP event')
  t.same(nextState.context.queue.map(c => c.type), ['sleep', 'sleep'], 'should be both sleep event')
})

test.only('mailbox actor interpret smoke testing', async t => {

  const actor = mailbox.wrap(childMachine)
  const interpreter = interpret(actor)

  // console.info('initialState:', actor.initialState)
  interpreter
    .onTransition(x => {
      console.info('onTransition: ')
      console.info('  - states:', x.value)
      console.info('  - event:', x.event.type)
    })
    .start()

  let snapshot = interpreter.getSnapshot()
  // console.info('snapshot:', snapshot)
  t.equal(snapshot.value, mailbox.states.idle, 'should stay at idle state after start')
  t.equal(snapshot.event.type, mailbox.types.IDLE, 'should received IDLE event from child after start')

  let ms = 10
  const step = 10

  interpreter.send({
    type: 'sleep',
    ms,
  })
  ms += step

  snapshot = interpreter.getSnapshot()
  t.equal(snapshot.value, mailbox.states.busy, 'should be state.busy after received the 1st EVENT sleep')
  t.equal(snapshot.event.type, mailbox.types.DISPATCH, 'should have event DISPATCH after received the 1st EVENT sleep')
  t.equal(snapshot.context.queue.length, 0, 'should have 1 event in queue after received the 1st EVENT sleep')

  Array.from({ length: 2 }).forEach(() => {
    interpreter.send({
      type: 'sleep',
      ms,
    })
    ms += step
  })

  // snapshot = interpreter.getSnapshot()awake
  // t.equal(snapshot.value, mailbox.states.busy, 'should be state.busy after received 2 more EVENT sleep')
  // t.equal(snapshot.event.type, mailbox.types.DISPATCH, 'should have event DISPATCH after received 2 more  EVENT sleep')
  // t.equal(snapshot.context.queue.length, 2, 'should have 1 event in queue after received 2 more EVENT sleep')

  // for (let i = 0; i < 2; i++) {
  //   console.info('sending sleep ', i)
  //   interpreter.send({
  //     type: 'sleep',
  //     n: i,
  //   })
  // }

  // let snapshot = interpreter.getSnapshot()
  // console.info('snapshot:', snapshot)
  // t.equal(nextState.context.queue.length, 2, 'should have 2 event in queue')
  // t.same(nextState.context.queue.map(c => c.type), ['sleep', 'sleep'], 'should be both sleep event')

  // interpreter.stop()
})
