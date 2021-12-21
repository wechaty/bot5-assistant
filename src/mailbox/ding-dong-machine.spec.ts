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
  StateFrom,
}                   from 'xstate'

import * as DingDong from './ding-dong-machine.fixture.js'
import * as Mailbox from './mod.js'

test('DingDong.machine smoke testing', async t => {
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
      Mailbox.Types.IDLE,
      DingDong.Types.DING,
    ],
    'should have received init/IDLE/DING events after initializing',
  )

  eventList.length = 0
  await sandbox.clock.runAllAsync()
  t.same(
    eventList,
    [
      DingDong.Events.DONG(1),
      Mailbox.Events.IDLE('ding-dong'),
    ],
    'should have received DONG/IDLE events after runAllAsync',
  )

  interpreter.stop()

  sandbox.restore()
})
