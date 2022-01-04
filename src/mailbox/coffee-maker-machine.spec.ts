#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/* eslint-disable sort-keys */

import {
  test,
  sinon,
}                   from 'tstest'

import {
  AnyEventObject,
  createMachine,
  interpret,
  actions,
}                   from 'xstate'

import * as CoffeeMaker from './coffee-maker-machine.fixture.js'
import * as Mailbox from './mod.js'

test('CoffeeMaker.machine smoke testing', async t => {
  const CUSTOMER = 'John'

  const sandbox = sinon.createSandbox({
    useFakeTimers: true,
  })

  const CHILD_ID = 'child'

  const parentMachine = createMachine({
    id: 'parent',
    initial: 'testing',
    invoke: {
      id: CHILD_ID,
      src: CoffeeMaker.machine,
    },
    states: {
      testing: {
        on: {
          [CoffeeMaker.Types.MAKE_ME_COFFEE]: {
            actions: actions.send((_, e) => e, { to: CHILD_ID }),
          },
        },
      },
    },
  })

  const interpreter = interpret(parentMachine)

  const eventList: AnyEventObject[] = []
  interpreter.onTransition(s => {
    eventList.push(s.event)

    console.info('onTransition: ')
    console.info('  - states:', s.value)
    console.info('  - event:', s.event.type)
    console.info()
  })

  interpreter.start()
  interpreter.send(CoffeeMaker.Events.MAKE_ME_COFFEE(CUSTOMER))
  t.same(
    eventList.map(e => e.type),
    [
      'xstate.init',
      Mailbox.Types.CHILD_IDLE,
      CoffeeMaker.Types.MAKE_ME_COFFEE,
    ],
    'should have received init/RECEIVE/MAKE_ME_COFFEE events after initializing',
  )

  eventList.length = 0
  await sandbox.clock.runAllAsync()
  t.same(
    eventList
      .filter(e => e.type === Mailbox.Types.CHILD_REPLY),
    [
      Mailbox.Events.CHILD_REPLY(CoffeeMaker.Events.COFFEE(CUSTOMER)),
    ],
    'should have received COFFEE/RECEIVE events after runAllAsync',
  )

  interpreter.stop()
  sandbox.restore()
})

test.only('XState machine will lost incoming messages(events) when receiving multiple messages at the same time', async t => {
  const sandbox = sinon.createSandbox({
    useFakeTimers: true,
  })

  const ITEM_NUMBERS = [...Array(10).keys()]
  const MAKE_ME_COFFEE_EVENT_LIST = ITEM_NUMBERS.map(i => CoffeeMaker.Events.MAKE_ME_COFFEE(String(i)))
  const COFFEE_EVENT_LIST         = ITEM_NUMBERS.map(i => CoffeeMaker.Events.COFFEE(String(i)))

  const containerMachine = createMachine({
    invoke: {
      id: 'child',
      src: CoffeeMaker.machine,
    },
    on: {
      [CoffeeMaker.Types.MAKE_ME_COFFEE]: {
        actions: [
          actions.send((_, e) => e, { to: 'child' }),
        ],
      },
    },
    states: {},
  })

  const interpreter = interpret(containerMachine)

  const eventList: AnyEventObject[] = []
  interpreter
    .onTransition(s => eventList.push(s.event))
    .start()

    MAKE_ME_COFFEE_EVENT_LIST.forEach(e => interpreter.send(e))

  await sandbox.clock.runAllAsync()
  // eventList.forEach(e => console.info(e))
  t.same(
    eventList
      .filter(e => e.type === Mailbox.Types.CHILD_REPLY),
    [
      COFFEE_EVENT_LIST.map(e =>
        Mailbox.Events.CHILD_REPLY(e),
      )[0],
    ],
    `should only get 1 COFFEE event no matter how many MAKE_ME_COFFEE events we sent (at the same time, total: ${MAKE_ME_COFFEE_EVENT_LIST.length})`,
  )

  interpreter.stop()
  sandbox.restore()
})
