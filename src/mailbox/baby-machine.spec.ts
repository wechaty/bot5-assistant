#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/* eslint-disable sort-keys */

import {
  test,
  sinon,
}                   from 'tstest'

import {
  createMachine,
  interpret,
  Interpreter,
  StateFrom,
}                   from 'xstate'

import * as Baby    from './baby-machine.fixture.js'
import * as Mailbox from './mod.js'

test('babyMachine smoke testing with sleeping under mock clock', async t => {
  const sandbox = sinon.createSandbox({
    useFakeTimers: true,
  })

  const CHILD_ID = 'child'

  const parentMachine = createMachine({
    id: 'parent',
    initial: 'testing',
    invoke: {
      id: CHILD_ID,
      src: Baby.machine,
      // autoForward: true,
    },
    states: {
      testing: {},
    },
  })

  const parentEventList: string[] = []
  const parentInterpreter = interpret(parentMachine)
    .onTransition(s => {
      parentEventList.push(s.event.type)

      console.info('onTransition (Parent): ')
      console.info('  - states:', s.value)
      console.info('  - event:', s.event.type)
      console.info()
    })
    .start()

  const childEventList: string[] = []
  const childRef = parentInterpreter.getSnapshot().children[CHILD_ID] as Interpreter<any>
  childRef.onTransition(s => {
    childEventList.push(s.event.type)

    console.info('onTransition (Child): ')
    console.info('  - states:', s.value)
    console.info('  - event:', s.event.type)
    console.info()
  })

  const getChildSnapshot: () => StateFrom<typeof Baby.machine> = () =>
    parentInterpreter.getSnapshot.call(childRef) as any

  let childSnapshot = getChildSnapshot()
  t.equal(childSnapshot.value, Baby.States.awake, 'babyMachine initial state should be awake')
  t.same(parentEventList, [
    'xstate.init',
    Mailbox.Types.RECEIVE,
    Baby.Types.PLAY,
  ], 'should have initial event list from parent')
  t.same(childEventList, [
    'xstate.init',
  ], 'should have initial event list from child')

  parentEventList.length = 0
  childEventList.length = 0
  childRef.send(Baby.events.SLEEP(10))
  childSnapshot = getChildSnapshot()
  t.equal(childSnapshot.value, Baby.States.sleeping, 'babyMachine state should be sleeping')
  t.equal(childSnapshot.context.ms, 10, 'babyMachine context.ms should be 10')
  t.same(parentEventList, [
    Baby.Types.REST,
    Baby.Types.DREAM,
  ], 'should have event list for parent')
  t.same(childEventList, [
    Baby.Types.SLEEP,
  ], 'should have event list for child')

  parentEventList.length = 0
  childEventList.length = 0
  childRef.send(Baby.events.SLEEP(100000))
  childSnapshot = getChildSnapshot()
  t.equal(childSnapshot.value, Baby.States.sleeping, 'babyMachine state should be sleeping')
  t.equal(childSnapshot.context.ms, 10, 'babyMachine context.ms should be 10 (new event has been dropped)')
  t.same(parentEventList, [], 'should no more response when sleeping for parent')
  t.same(childEventList, [
    Baby.Types.SLEEP,
  ], 'should no more response when sleeping for child')

  parentEventList.length = 0
  childEventList.length = 0
  await sandbox.clock.tickAsync(4)
  childSnapshot = getChildSnapshot()
  t.equal(childSnapshot.value, Baby.States.sleeping, 'babyMachine state should be sleeping after 1st 4 ms')
  t.equal(childSnapshot.context.ms, 10, 'babyMachine context.ms should be 10 (new event has been dropped) after 1st 4 ms')
  t.same(parentEventList, [], 'should no more response after 1st 4 ms for parent')
  t.same(childEventList, [], 'should no more response after 1st 4 ms for parent')

  parentEventList.length = 0
  childEventList.length = 0
  await sandbox.clock.tickAsync(4)
  childSnapshot = getChildSnapshot()
  t.equal(childSnapshot.value, Baby.States.sleeping, 'babyMachine state should be sleeping after 2nd 4 ms')
  t.equal(childSnapshot.context.ms, 10, 'babyMachine context.ms should be 10 (new event has been dropped) after 2nd 4 ms')
  t.same(parentEventList, [
    Baby.Types.CRY,
  ], 'should cry in middle night (after 2nd 4 ms) for parent')
  t.same(childEventList, [
    "xstate.after(cryMs)#baby.baby/sleeping",
  ], 'should cry in middle night (after 2nd 4 ms) for child')

  parentEventList.length = 0
  childEventList.length = 0
  await sandbox.clock.tickAsync(2)
  childSnapshot = getChildSnapshot()
  t.equal(childSnapshot.value, Baby.States.awake, 'babyMachine state should be awake after sleep')
  t.equal(childSnapshot.context.ms, null, 'babyMachine context.ms should be cleared after sleep')
  t.same(parentEventList, [
    Baby.Types.PEE,
    Mailbox.Types.RECEIVE,
    Baby.Types.PLAY,
  ], 'should pee after night and start paly in the morning, with idle event (after sleep) for parent')
  t.same(childEventList, [
    'xstate.after(ms)#baby.baby/sleeping',
  ], 'should pee after night and start paly in the morning, with idle event (after sleep) for child')

  // console.info(eventList)
  /**
   * Huan(202112) xstate bug:
   *  parentInterpreter.stop() will stop parent first,
   *    then if child has any `exit: sendParent(...)` actions,
   *    will throw exception
   */
  parentInterpreter.stop()

  sandbox.restore()
})
