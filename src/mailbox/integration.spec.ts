#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/* eslint-disable sort-keys */

import {
  test,
  sinon,
}                   from 'tstest'

import {
  AnyEventObject,
  interpret,
  createMachine,
  actions,
  // spawn,
}                   from 'xstate'

import * as Mailbox from './mod.js'

const dingMachine = createMachine<{ i: null | number }>({
  initial: 'idle',
  context: {
    i: 10,
  },
  states: {
    idle: {
      entry: [
        Mailbox.Actions.sendParentIdle('ding-dong'),
      ],
      on: {
        DING: {
          target: 'busy',
          actions: actions.assign({
            i: (_, e) => {
              console.info('received i: ', (e as any).i)
              return (e as any).i
            },
          }),
        },
      },
    },
    busy: {
      after: {
        randomMs: {
          actions: [
            actions.sendParent(ctx => ({ type: 'DONG', i: ctx.i })),
          ],
          target: 'idle',
        },
      },
    },
  },
}, {
  delays: {
    randomMs: (_, e) => {
      console.info('randomMs: ', (e as any).i)
      return Math.floor(Math.random() * 10)
    },
  },
})

test('XState actor problem: async tasks running concurrency', async t => {
  const MESSAGE_CONCURRENCY_NUM = 100

  const sandbox = sinon.createSandbox({
    useFakeTimers: true,
  })

  const containerMachine = createMachine({
    invoke: {
      src: dingMachine,
      autoForward: true,
    },
    states: {},
  })

  const interpreter = interpret(
    containerMachine,
  )

  const eventList: AnyEventObject[] = []
  interpreter
    .onTransition(s => {
      eventList.push(s.event)
      // console.info('Received event', s.event)
      // console.info('Transition to', s.value)
    })
    .start()

  interpreter.send(
    [...Array(MESSAGE_CONCURRENCY_NUM).keys()].map(i =>
      ({ type: 'DING', i }),
    ),
  )

  await sandbox.clock.runAllAsync()
  // eventList.forEach(e => console.info(e))
  t.same(
    eventList
      .filter(e => e.type === 'DONG')
      .map(e => (e as any).i),
    [0],
    'should only received the first DING event: others have been discarded',
  )

  interpreter.stop()
  sandbox.restore()
})

test('Mailbox.address (actor) smoke testing: process messages one by one', async t => {
  const MESSAGE_CONCURRENCY_NUM = 100

  const sandbox = sinon.createSandbox({
    useFakeTimers: true,
  })

  const interpreter = interpret(
    Mailbox.address(dingMachine),
  )

  const eventList: AnyEventObject[] = []
  interpreter
    .onTransition(s => {
      eventList.push(s.event)
      console.info('Received event', s.event)
      console.info('Transition to', s.value)
    })
    .start()

  interpreter.send(
    [...Array(MESSAGE_CONCURRENCY_NUM).keys()].map(i =>
      ({ type: 'DING', i }),
    ),
  )

  await sandbox.clock.runAllAsync()
  // eventList.forEach(e => console.info(e))

  t.same(
    eventList
      .filter(e => e.type === 'DONG')
      .map(e => (e as any).i),
    [...Array(MESSAGE_CONCURRENCY_NUM).keys()],
    'should reply all the DING events',
  )

  interpreter.stop()
  sandbox.restore()
})
