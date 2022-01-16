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
}                   from 'xstate'

import * as DingDong  from './ding-dong-machine.fixture.js'
import * as Mailbox   from './mod.js'

test('DingDong.machine process one DING event', async t => {
  const sandbox = sinon.createSandbox({
    useFakeTimers: true,
  })

  const CHILD_ID = 'child'

  const parentMachine = createMachine({
    id: 'parent',
    initial: 'testing',
    invoke: {
      id: CHILD_ID,
      src: DingDong.machine,
      autoForward: true,
    },
    states: {
      testing: {},
    },
  })

  const interpreter = interpret(parentMachine)

  const eventList: AnyEventObject[] = []
  interpreter.onTransition(s => {
    eventList.push(s.event)

    // console.info('onTransition: ')
    // console.info('  - states:', s.value)
    // console.info('  - event:', s.event.type)
    // console.info()
  })

  interpreter.start()
  interpreter.send(DingDong.Events.DING(1))
  t.same(
    eventList.map(e => e.type),
    [
      'xstate.init',
      Mailbox.Types.CHILD_IDLE,
      DingDong.Types.DING,
    ],
    'should have received init/RECEIVE/DING events after initializing',
  )

  eventList.length = 0
  await sandbox.clock.runAllAsync()
  // eventList.forEach(e => console.info(e))
  t.same(
    eventList,
    [
      Mailbox.Events.CHILD_IDLE('idle'),
      Mailbox.Events.CHILD_REPLY(DingDong.Events.DONG(1)),
    ],
    'should have received DONG/RECEIVE events after runAllAsync',
  )

  interpreter.stop()

  sandbox.restore()
})

test('DingDong.machine process 2+ message at once: only be able to process the first message when receiving multiple events at the same time', async t => {
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
    .onTransition(s => eventList.push(s.event))
    .start()

  interpreter.send([
    DingDong.Events.DING(0),
    DingDong.Events.DING(1),
  ])

  await sandbox.clock.runAllAsync()
  eventList.forEach(e => console.info(e))
  t.same(
    eventList
      .filter(e => e.type === Mailbox.Types.CHILD_REPLY),
    [
      Mailbox.Events.CHILD_REPLY(DingDong.Events.DONG(0)),
    ],
    'should reply DONG to the first DING event',
  )

  interpreter.stop()
  sandbox.restore()
})
