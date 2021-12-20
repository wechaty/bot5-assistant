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

const MAX_DELAY_MS = 10

const dingMachine = createMachine<{ i: null | number }>({
  initial: 'idle',
  context: {
    i: null,
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
              // console.info('received i: ', (e as any).i)
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
    randomMs: _ => Math.floor(Math.random() * MAX_DELAY_MS),
  },
})

test('XState actor problem: async tasks running with concurrency', async t => {
  const rangeList       = [...Array(100).keys()]
  const DING_EVENT_LIST = rangeList.map(i => ({ type: 'DING', i }))
  const DONG_EVENT_LIST = rangeList.map(i => ({ type: 'DONG', i }))

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
      if (s.event.type === 'DONG') {
        eventList.push(s.event)
      }
      // console.info('Received event', s.event)
      // console.info('Transition to', s.value)
    })
    .start()

  interpreter.send(DING_EVENT_LIST)

  await sandbox.clock.runAllAsync()
  // eventList.forEach(e => console.info(e))
  t.equal(eventList.length, 1, 'should only received one DONG event')
  t.same(eventList[0], DONG_EVENT_LIST[0], 'should only received the first DING event: others have been discarded',
  )

  interpreter.stop()
  sandbox.restore()
})

test('Mailbox.address (actor): enforce process messages one by one', async t => {
  const rangeList       = [...Array(100).keys()]
  const DING_EVENT_LIST = rangeList.map(i => ({ type: 'DING', i }))
  const DONG_EVENT_LIST = rangeList.map(i => ({ type: 'DONG', i }))

  const sandbox = sinon.createSandbox({
    useFakeTimers: true,
  })

  const interpreter = interpret(
    Mailbox.address(dingMachine),
  )

  const eventList: AnyEventObject[] = []
  interpreter
    .onTransition(s => {
      if (s.event.type === 'DONG') {
        eventList.push(s.event)
      }
      // console.info('Received event', s.event)
      // console.info('Transition to', s.value)
    })
    .start()

  interpreter.send(DING_EVENT_LIST)

  await sandbox.clock.runAllAsync()
  // eventList.forEach(e => console.info(e))

  t.same(eventList, DONG_EVENT_LIST, 'should reply all the DING events')

  interpreter.stop()
  sandbox.restore()
})

test('Mailbox.address as an event proxy', async t => {
  const rangeList       = [...Array(100).keys()]
  const DING_EVENT_LIST = rangeList.map(i => ({ type: 'DING', i }))
  const DONG_EVENT_LIST = rangeList.map(i => ({ type: 'DONG', i }))

  const MAILBOX_CHILD_ID = 'mailbox-child-id'

  const sandbox = sinon.createSandbox({
    useFakeTimers: true,
  })

  const parentMachine = createMachine({
    invoke: {
      id: MAILBOX_CHILD_ID,
      src: Mailbox.address(dingMachine),
      /**
       * Huan(202112): autoForward event will not set `origin` to the forwarder.
       *  think it like a SNAT/DNAT in iptables?
       */
      // autoForward: true,
    },
    initial: 'testing',
    states: {
      testing: {
        on: {
          DING: {
            actions: actions.send((_, e) => e, { to: MAILBOX_CHILD_ID }),
          },
        },
      },
    },
  })

  const interpreter = interpret(
    parentMachine,
  )

  const eventList: AnyEventObject[] = []
  interpreter
    .onTransition(s => {
      if (s.event.type === 'DONG') {
        eventList.push(s.event)
      }
      console.info('Received event', s.event)
      console.info('Transition to', s.value)
    })
    .start()

  interpreter.send(DING_EVENT_LIST)

  await sandbox.clock.runAllAsync()
  // eventList.forEach(e => console.info(e))

  t.same(eventList, DONG_EVENT_LIST, 'should reply all the DING events')

  interpreter.stop()
  sandbox.restore()
})
