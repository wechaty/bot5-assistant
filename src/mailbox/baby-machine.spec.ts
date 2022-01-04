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
  Interpreter,
  StateFrom,
}                   from 'xstate'

import * as Baby    from './baby-machine.fixture.js'
import { Mailbox } from './mod.js'

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

  const parentEventList: AnyEventObject[] = []
  const parentInterpreter = interpret(parentMachine)
    .onTransition(s => {
      parentEventList.push(s.event)

      console.info('onTransition (Parent): ')
      console.info('  - states:', s.value)
      console.info('  - event:', s.event.type)
      console.info()
    })
    .start()

  const childEventList: AnyEventObject[] = []
  const childRef = parentInterpreter.getSnapshot().children[CHILD_ID] as Interpreter<any>
  childRef.onTransition(s => {
    childEventList.push(s.event)

    console.info('onTransition (Child): ')
    console.info('  - states:', s.value)
    console.info('  - event:', s.event.type)
    console.info()
  })

  const getChildSnapshot: () => StateFrom<typeof Baby.machine> = () =>
    parentInterpreter.getSnapshot.call(childRef) as any

  let childSnapshot = getChildSnapshot()
  t.equal(childSnapshot.value, Baby.States.awake, 'babyMachine initial state should be awake')
  t.same(childEventList.map(e => e.type), [
    'xstate.init',
  ], 'should have initial event list from child')
  t.same(parentEventList.map(e => e.type), [
    'xstate.init',
    Mailbox.Types.CHILD_IDLE,
    Mailbox.Types.CHILD_REPLY,
  ], 'should have initial event list from parent')
  t.same(
    parentEventList
      .filter(e => e.type === Mailbox.Types.CHILD_REPLY),
    [
      Mailbox.Events.CHILD_REPLY(
        Baby.Events.PLAY(),
      ),
    ],
    'should have got PLAY event after init',
  )

  parentEventList.length = 0
  childEventList.length = 0
  childRef.send(Baby.Events.SLEEP(10))
  childSnapshot = getChildSnapshot()
  t.equal(childSnapshot.value, Baby.States.sleeping, 'babyMachine state should be sleeping')
  t.equal(childSnapshot.context.ms, 10, 'babyMachine context.ms should be 10')
  t.same(childEventList.map(e =>e.type), [
    Baby.Types.SLEEP,
  ], 'should have event list for child')
  t.same(parentEventList.map(e => e.type), [
    Mailbox.Types.CHILD_REPLY,
    Mailbox.Types.CHILD_REPLY,
  ], 'should have CHILD_IDLE & CHILD_REPLY event list for parent')
  t.same(
    parentEventList
      .filter(e => e.type === Mailbox.Types.CHILD_REPLY),
    [
      Baby.Events.REST(),
      Baby.Events.DREAM(),
    ].map(e => Mailbox.Events.CHILD_REPLY(e)),
    'should have got REST & DREAM event after SLEEP',
  )
  parentEventList.length = 0
  childEventList.length = 0
  childRef.send(Baby.Events.SLEEP(100000))
  childSnapshot = getChildSnapshot()
  t.equal(childSnapshot.value, Baby.States.sleeping, 'babyMachine state should be sleeping')
  t.equal(childSnapshot.context.ms, 10, 'babyMachine context.ms should be 10 (new event has been dropped)')
  t.same(parentEventList, [], 'should no more response when sleeping for parent')
  t.same(childEventList.map(e => e.type), [
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
  t.same(
    parentEventList
      .filter(e => e.type === Mailbox.Types.CHILD_REPLY),
    [
      Mailbox.Events.CHILD_REPLY(Baby.Events.CRY()),
    ],
    'should cry in middle night (after 2nd 4 ms) for parent',
  )
  t.same(childEventList.map(e => e.type), [
    "xstate.after(cryMs)#baby.baby/sleeping",
  ], 'should cry in middle night (after 2nd 4 ms) for child')

  parentEventList.length = 0
  childEventList.length = 0
  await sandbox.clock.tickAsync(2)
  childSnapshot = getChildSnapshot()
  t.equal(childSnapshot.value, Baby.States.awake, 'babyMachine state should be awake after sleep')
  t.equal(childSnapshot.context.ms, null, 'babyMachine context.ms should be cleared after sleep')
  t.same(parentEventList.map(e => e.type), [
    Mailbox.Types.CHILD_REPLY,
    Mailbox.Types.CHILD_IDLE,
    Mailbox.Types.CHILD_REPLY,
  ], 'should pee after night and start paly in the morning, with idle event (after sleep) for parent')
  t.same(
    parentEventList
      .filter(e => e.type === Mailbox.Types.CHILD_REPLY),
    [
      Baby.Events.PEE(),
      Baby.Events.PLAY(),
    ].map(e => Mailbox.Events.CHILD_REPLY(e)),
    'should cry in middle night (after 2nd 4 ms) for parent',
  )
  t.same(childEventList.map(e => e.type), [
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
