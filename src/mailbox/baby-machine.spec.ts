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

import * as baby    from './baby-machine.fixture.js'
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
      src: baby.machine,
      autoForward: true,
    },
    states: {
      testing: {},
    },
  })

  const interpreter = interpret(parentMachine)

  const eventList: string[] = []
  interpreter.onTransition(s => {
    eventList.push(s.event.type)

    console.info('onTransition: ')
    console.info('  - states:', s.value)
    console.info('  - event:', s.event.type)
    console.info()
  })

  interpreter.start()

  const getChildSnapshot: () => StateFrom<typeof baby.machine> = () => interpreter.getSnapshot.call(
    interpreter.getSnapshot().children[CHILD_ID],
  ) as any

  let snapshot = getChildSnapshot()
  t.equal(snapshot.value, baby.States.awake, 'babyMachine initial state should be awake')
  t.same(eventList, [
    'xstate.init',
    Mailbox.Types.IDLE,
    baby.Types.PLAY,
  ], 'should have initial event list')

  eventList.length = 0
  interpreter.send(baby.events.SLEEP(10))
  snapshot = getChildSnapshot()
  t.equal(snapshot.value, baby.States.sleeping, 'babyMachine state should be sleeping')
  t.equal(snapshot.context.ms, 10, 'babyMachine context.ms should be 10')
  t.same(eventList, [
    baby.Types.SLEEP,
    baby.Types.EAT,
    baby.Types.REST,
    baby.Types.DREAM,
  ], 'should have event list')

  eventList.length = 0
  interpreter.send(baby.events.SLEEP(100000))
  snapshot = getChildSnapshot()
  t.equal(snapshot.value, baby.States.sleeping, 'babyMachine state should be sleeping')
  t.equal(snapshot.context.ms, 10, 'babyMachine context.ms should be 10 (new event has been dropped)')
  t.same(eventList, [
    baby.Types.SLEEP,
  ], 'should no more response when sleeping')

  eventList.length = 0
  await sandbox.clock.tickAsync(4)
  snapshot = getChildSnapshot()
  t.equal(snapshot.value, baby.States.sleeping, 'babyMachine state should be sleeping after 1st 4 ms')
  t.equal(snapshot.context.ms, 10, 'babyMachine context.ms should be 10 (new event has been dropped) after 1st 4 ms')
  t.same(eventList, [], 'should no more response after 1st 4 ms')

  eventList.length = 0
  await sandbox.clock.tickAsync(4)
  snapshot = getChildSnapshot()
  t.equal(snapshot.value, baby.States.sleeping, 'babyMachine state should be sleeping after 2nd 4 ms')
  t.equal(snapshot.context.ms, 10, 'babyMachine context.ms should be 10 (new event has been dropped) after 2nd 4 ms')
  t.same(eventList, [
    baby.Types.CRY,
  ], 'should cry in middle night (after 2nd 4 ms)')

  eventList.length = 0
  await sandbox.clock.tickAsync(2)
  snapshot = getChildSnapshot()
  t.equal(snapshot.value, baby.States.awake, 'babyMachine state should be awake after sleep')
  t.equal(snapshot.context.ms, undefined, 'babyMachine context.ms should be cleared after sleep')
  t.same(eventList, [
    baby.Types.PEE,
    Mailbox.Types.IDLE,
    baby.Types.PLAY,
  ], 'should pee after night and start paly in the morning, with idle event (after sleep)')

  // console.info(eventList)
  /**
   * Huan(202112) xstate bug:
   *  interpreter.stop() will stop parent first,
   *    then if child has any `exit: sendParent(...)` actions,
   *    will throw exception
   */
  // interpreter.stop()

  sandbox.restore()
})
