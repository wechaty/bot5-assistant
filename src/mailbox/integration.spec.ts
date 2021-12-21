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
import * as DingDong from './ding-dong-machine.fixture.js'

const ITEM_NUMBERS = [...Array(10).keys()]

const DING_EVENT_LIST = ITEM_NUMBERS.map(i =>
  DingDong.Events.DING(i),
)
const DONG_EVENT_LIST = ITEM_NUMBERS.map(i =>
  DingDong.Events.DONG(i),
)

test('XState machine problem: async tasks running with concurrency', async t => {
  const sandbox = sinon.createSandbox({
    useFakeTimers: true,
  })

  const containerMachine = createMachine({
    invoke: {
      src: DingDong.machine,
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
      if (s.event.type === DingDong.Types.DONG) {
        eventList.push(s.event)
      }
      // console.info('Received event', s.event)
      // console.info('Transition to', s.value)
    })
    .start()

  interpreter.send(DING_EVENT_LIST)

  await sandbox.clock.runAllAsync()
  // eventList.forEach(e => console.info(e))
  t.equal(eventList.length, 1, `should only reply 1 DONG event to total ${DING_EVENT_LIST.length} DING events`)
  t.same(eventList[0], DONG_EVENT_LIST[0], 'should reply to the first event',
  )

  interpreter.stop()
  sandbox.restore()
})

test('Mailbox.address(machine) as an actor should enforce process messages one by one', async t => {
  const sandbox = sinon.createSandbox({
    useFakeTimers: true,
  })

  const interpreter = interpret(
    Mailbox.address(DingDong.machine),
  )

  const eventList: AnyEventObject[] = []
  interpreter
    .onTransition(s => {
      if (s.event.type === DingDong.Types.DONG) {
        eventList.push(s.event)
      }
      // console.info('Received event', s.event)
      // console.info('Transition to', s.value)
    })
    .start()

  interpreter.send(DING_EVENT_LIST)

  await sandbox.clock.runAllAsync()
  // eventList.forEach`(e => console.info(e))

  t.same(eventList, DONG_EVENT_LIST, `should reply total ${DONG_EVENT_LIST.length} DONG events to ${DING_EVENT_LIST.length} DING events`)

  interpreter.stop()
  sandbox.restore()
})

test('parentMachine with invoke.src=Mailbox.address (proxy events)', async t => {
  const CHILD_ID = 'mailbox-child-id'

  const sandbox = sinon.createSandbox({
    useFakeTimers: true,
  })

  const parentMachine = createMachine({
    invoke: {
      id: CHILD_ID,
      src: Mailbox.address(DingDong.machine),
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
          [DingDong.Types.DING]: {
            actions: actions.send(
              (_, e) => e,
              { to: CHILD_ID },
            ),
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
      if (s.event.type === DingDong.Types.DONG) {
        eventList.push(s.event)
      }
      console.info('Received event', s.event)
      console.info('Transition to', s.value)
    })
    .start()

  DING_EVENT_LIST.forEach(e => interpreter.send(e))

  await sandbox.clock.runAllAsync()

  // t.equal(eventList.length, DONG_EVENT_LIST.length, 'should received enough DONG events')
  t.same(eventList, DONG_EVENT_LIST, 'should get replied DONG events from every DING events')

  interpreter.stop()
  sandbox.restore()
})
