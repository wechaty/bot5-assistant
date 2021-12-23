#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/* eslint-disable sort-keys */

import {
  test,
  sinon,
}                   from 'tstest'

import {
  interpret,
}                   from 'xstate'

import { spyTransitionMachine } from './spy-transition-machine.fixture.js'

test('AssignTransition.machine actions order testing', async t => {
  const sandbox = sinon.createSandbox({
    useFakeTimers: true,
  })
  const spy = sandbox.spy()
  const machine = spyTransitionMachine(spy)
  const interpreter = interpret(machine)

  interpreter.onTransition(s => {
    spy('Received ' + s.event.type)
    spy('Transition to ' + s.value)
  })

  interpreter.start()

  spy('interpreter.send("test")')
  interpreter.send('test')

  await sandbox.clock.runAllAsync()
  // console.info(spy.args)
  const EXPECTED_ARGS = [
    [ 'step0-entry.assign' ],
    [ 'step0-entry.func: step0-entry.assign' ],
    [ 'Received xstate.init' ],
    [ 'Transition to step0' ],
    [ 'interpreter.send("test")' ],
    [ 'step0-exit.assign' ],
    [ 'step0-on.assign' ],
    [ 'step1-entry.assign' ],
    [ 'step1-exit.assign' ],
    [ 'step2-entry.assign' ],
    [ 'step0-exit.func: step2-entry.assign' ],
    [ 'step0-on.func: step2-entry.assign' ],
    [ 'step1-entry.func: step2-entry.assign' ],
    [ 'step1-exit.func: step2-entry.assign' ],
    [ 'step2-entry.func: step2-entry.assign' ],
    [ 'Received test' ],
    [ 'Transition to step2' ],
    [ 'step2-exit.assign' ],
    [ 'step2-after.assign' ],
    [ 'step2-exit.func: step2-after.assign' ],
    [ 'step2-after.func: step2-after.assign' ],
    [ 'Received xstate.after(0)#(machine).step2' ],
    [ 'Transition to step10' ]
  ]

  t.same(spy.args, EXPECTED_ARGS, 'should get the same order as expected')

  interpreter.stop()
  sandbox.restore()
})
