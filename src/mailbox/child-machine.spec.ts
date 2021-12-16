#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/* eslint-disable sort-keys */

import {
  test,
  sinon,
}                   from 'tstest'

import {
  createMachine,
  interpret,
  StateFrom,
}                   from 'xstate'

import * as child from './child-machine.fixture.js'

test('childMachine smoke testing with sleeping under mock clock', async t => {
  const sandbox = sinon.createSandbox({
    useFakeTimers: true,
  })

  const parentMachine = createMachine({
    id: 'parent',
    initial: 'testing',
    invoke: {
      id: 'child',
      src: child.machine,
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

  const getChildSnapshot: () => StateFrom<typeof child.machine> = () => interpreter.getSnapshot.call(
    interpreter.getSnapshot().children['child'],
  ) as any

  let snapshot = getChildSnapshot()
  t.equal(snapshot.value, child.states.awake, 'childMachine initial state should be awake')

  interpreter.send(child.events.SLEEP(10))
  snapshot = getChildSnapshot()
  t.equal(snapshot.value, child.states.sleeping, 'childMachine state should be sleeping')
  t.equal(snapshot.context.ms, 10, 'childMachine context.ms should be 10')

  interpreter.send(child.events.SLEEP(100000))
  snapshot = getChildSnapshot()
  t.equal(snapshot.value, child.states.sleeping, 'childMachine state should be sleeping')
  t.equal(snapshot.context.ms, 10, 'childMachine context.ms should be 10 (new event has been dropped)')

  await sandbox.clock.tickAsync(9)
  snapshot = getChildSnapshot()
  t.equal(snapshot.value, child.states.sleeping, 'childMachine state should be sleeping after 9 ms')
  t.equal(snapshot.context.ms, 10, 'childMachine context.ms should be 10 (new event has been dropped) after 9 ms')

  await sandbox.clock.tickAsync(1)
  snapshot = getChildSnapshot()
  t.equal(snapshot.value, child.states.awake, 'childMachine state should be awake after 10 ms')
  t.equal(snapshot.context.ms, undefined, 'childMachine context.ms should be cleared after 10 ms')

  interpreter.stop()
  sandbox.restore()
})
