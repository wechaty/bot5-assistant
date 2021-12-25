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

import * as Mailbox     from './mod.js'
import * as DingDong    from './ding-dong-machine.fixture.js'
import * as CoffeeMaker from './coffee-maker-machine.fixture.js'

test.only('Mailbox.address(DingDong.machine) as an actor should enforce process messages one by one', async t => {
  const ITEM_NUMBERS = [...Array(3).keys()]

  const DING_EVENT_LIST = ITEM_NUMBERS.map(i =>
    DingDong.Events.DING(i),
  )
  const DONG_EVENT_LIST = ITEM_NUMBERS.map(i =>
    DingDong.Events.DONG(i),
  )

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
      console.info('Received event', s.event)
      console.info('Transition to', s.value)
    })
    .start()

    DING_EVENT_LIST.forEach(e => interpreter.send(e))

  // await sandbox.clock.runAllAsync()
  // // eventList.forEach`(e => console.info(e))

  // t.same(eventList, DONG_EVENT_LIST, `should reply total ${DONG_EVENT_LIST.length} DONG events to ${DING_EVENT_LIST.length} DING events`)

  // interpreter.stop()
  sandbox.restore()
})

test('parentMachine with invoke.src=Mailbox.address(DingDong.machine) should proxy events', async t => {
  const ITEM_NUMBERS = [...Array(1).keys()]

  const DING_EVENT_LIST = ITEM_NUMBERS.map(i =>
    DingDong.Events.DING(i),
  )
  const DONG_EVENT_LIST = ITEM_NUMBERS.map(i =>
    DingDong.Events.DONG(i),
  )

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
      // console.info('Received event', s.event)
      // console.info('Transition to', s.value)
    })
    .start()

  DING_EVENT_LIST.forEach(e => interpreter.send(e))

  await sandbox.clock.runAllAsync()

  t.same(eventList, DONG_EVENT_LIST, 'should get replied DONG events from every DING events')

  interpreter.stop()
  sandbox.restore()
})

test('Mailbox.address(CoffeeMaker.machine) as an actor should enforce process messages one by one', async t => {
  const ITEM_NUMBERS = [...Array(10).keys()]

  const MAKE_ME_COFFEE_EVENT_LIST = ITEM_NUMBERS.map(i =>
    CoffeeMaker.Events.MAKE_ME_COFFEE(String(i)),
  )
  const COFFEE_EVENT_LIST = ITEM_NUMBERS.map(i =>
    CoffeeMaker.Events.COFFEE(String(i)),
  )

  const sandbox = sinon.createSandbox({
    useFakeTimers: true,
  })

  const interpreter = interpret(
    Mailbox.address(CoffeeMaker.machine),
  )

  const eventList: AnyEventObject[] = []
  interpreter
    .onTransition(s => {
      if (s.event.type === CoffeeMaker.Types.COFFEE) {
        eventList.push(s.event)
      }
      console.info('Received event', s.event)
      console.info('Transition to', s.value)
    })
    .start()

  interpreter.send(MAKE_ME_COFFEE_EVENT_LIST)

  await sandbox.clock.runAllAsync()
  // eventList.forEach`(e => console.info(e))

  t.same(eventList, COFFEE_EVENT_LIST, `should reply total ${COFFEE_EVENT_LIST.length} COFFEE events to ${MAKE_ME_COFFEE_EVENT_LIST.length} MAKE_ME_COFFEE events`)

  interpreter.stop()
  sandbox.restore()
})
