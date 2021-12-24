#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/* eslint-disable sort-keys */

import {
  test,
  sinon,
}                   from 'tstest'

import {
  interpret,
}                   from 'xstate'

import { spyActionsMachine } from './spy-actions-machine.fixture.js'

test('spyActionsMachine actions order testing', async t => {
  const sandbox = sinon.createSandbox({
    useFakeTimers: true,
  })
  const spy = sandbox.spy()
  const machine = spyActionsMachine(spy)
  const interpreter = interpret(machine)

  interpreter.onEvent(e       => spy('onEvent: received ' + e.type))
  interpreter.onTransition(s  => spy('onTransition: transition to ' + s.value))

  interpreter.start()

  spy('interpreter.send("TEST")')
  interpreter.send('TEST')

  await sandbox.clock.runAllAsync()
  // console.info(spy.args)
  const EXPECTED_ARGS = [
    [ 'states.step0.entry.assign' ],
    [ 'states.step0.entry.expr context.lastSetBy:states.step0.entry.assign' ],
    [ 'onEvent: received xstate.init' ],
    [ 'onTransition: transition to step0' ],
    [ 'interpreter.send("TEST")' ],
    /**
     * Huan(202112):
     *
     * When receiving a EVENT:
     *  1. the actions execute order in transition is:
     *    1. exit
     *    2. on/always/after
     *    3. entry
     *  2. all `assign` actions will be ran as top priority before any of other actions, from any hooks.
     *  3. the `context` in the `expr` callback will be the lastest `context` value when the `state` is stable,
     *    no matter than which hook the action is putted(exit/on/always/after/entry).
     */
    [ 'states.step0.exit.assign' ],
    [ 'states.step0.on.assign' ],
    [ 'states.step1.entry.assign' ],
    [ 'states.step1.exit.assign' ],
    [ 'states.step2.entry.assign' ],
    [ 'states.step0.exit.expr context.lastSetBy:states.step2.entry.assign' ],
    [ 'states.step0.on.expr context.lastSetBy:states.step2.entry.assign' ],
    [ 'states.step1.entry.expr context.lastSetBy:states.step2.entry.assign' ],
    [ 'states.step1.exit.expr context.lastSetBy:states.step2.entry.assign' ],
    [ 'states.step2.entry.expr context.lastSetBy:states.step2.entry.assign' ],
    [ 'onEvent: received TEST' ],
    [ 'onTransition: transition to step2' ],
    [ 'states.step2.exit.assign' ],
    [ 'states.step2.after.assign' ],
    [ 'states.step3.entry.assign' ],
    [ 'states.step2.exit.expr context.lastSetBy:states.step3.entry.assign' ],
    [ 'states.step2.after.expr context.lastSetBy:states.step3.entry.assign' ],
    [ 'states.step3.entry.expr context.lastSetBy:states.step3.entry.assign' ],
    [ 'onEvent: received xstate.after(0)#(machine).step2' ],
    [ 'onTransition: transition to step3' ],
  ]

  t.same(spy.args, EXPECTED_ARGS, 'should get the same order as expected')

  interpreter.stop()
  sandbox.restore()
})
