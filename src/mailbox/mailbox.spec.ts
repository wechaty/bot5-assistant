#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/* eslint-disable sort-keys */

import {
  test,
  sinon,
}                   from 'tstest'

import {
  interpret,
  createMachine,
  actions,
  StateValue,
}                   from 'xstate'

import { address }  from './mailbox.js'
import { Types }    from './types.js'
import { States }   from './states.js'

import * as Baby   from './baby-machine.fixture.js'

test('Mailbox.address() transition nextState smoke testing', async t => {
  const mailbox = address(Baby.machine)

  // console.info('initialState:', actor.initialState)

  let nextState = mailbox.transition(mailbox.initialState, Baby.events.SLEEP(10))
  // console.info(nextState.actions)
  t.ok(nextState.actions.some(a => {
    return a.type === 'xstate.send' && a['event'].type === Types.NOTIFY
  }), 'should have triggered NOTIFY event by sending IDLE event')

  nextState = mailbox.transition(nextState, Baby.events.SLEEP(10))
  t.equal(nextState.context.messageQueue.length, 2, 'should have 2 event in queue after sent two SLEEP event')
  t.same(nextState.context.messageQueue.map(c => c.type), new Array(2).fill(Baby.Types.SLEEP), 'should be both sleep event')
})

test.only('Mailbox.address interpret smoke testing: 1 event', async t => {
  const sandbox = sinon.createSandbox({
    useFakeTimers: true,
  })

  const mailbox = address(Baby.machine)
  const interpreter = interpret(mailbox)

  interpreter
    .onTransition(x => {
      console.info('onTransition: ')
      console.info('  - states:', x.value)
      console.info('  - event:', x.event.type)
      console.info('----------------')
    })
    .start()

  // let snapshot = interpreter.getSnapshot()
  // // console.info('snapshot:', snapshot)
  // t.same(snapshot.value, {
  //   router  : States.idle,
  //   message : States.idle,
  //   child   : States.idle,
  // }, 'should stay at idle state after start')
  // t.equal(snapshot.event.type, Types.DISPATCH, 'should received DISPATCH event aftrer child sent IDLE')

  // interpreter.send(Baby.events.SLEEP(10))
  // snapshot = interpreter.getSnapshot()
  // t.same(snapshot.value, {
  //   router  : States.idle,
  //   message : States.idle,
  //   child   : States.busy,
  // }, 'should be state.busy after received the 1st EVENT sleep')
  // t.equal(snapshot.event.type, Baby.Types.DREAM, 'should receive event child.Types.DREAM after received the 1st EVENT sleep')
  // t.equal(snapshot.context.messageQueue.length, 0, 'should have 0 event in queue after received the 1st EVENT sleep')

  // await sandbox.clock.tickAsync(9)
  // snapshot = interpreter.getSnapshot()
  // t.same(snapshot.value, {
  //   router  : States.idle,
  //   message : States.idle,
  //   child   : States.busy,
  // }, 'should be state.busy after received the 1st EVENT sleep')
  // t.equal(snapshot.event.type, Baby.Types.CRY, 'should receive event child.Types.CRY after before wakeup')
  // t.equal(snapshot.context.messageQueue.length, 0, 'should have 0 event in queue before wakeup')

  // await sandbox.clock.tickAsync(1)
  // snapshot = interpreter.getSnapshot()
  // t.same(snapshot.value, {
  //   router  : States.idle,
  //   message : States.idle,
  //   child   : States.idle,
  // }, 'should be state.busy after received the 1st EVENT sleep')
  // t.equal(snapshot.event.type, Baby.Types.PLAY, 'should receive event child.Types.PLAY after sleep')
  // t.equal(snapshot.context.messageQueue.length, 0, 'should have 0 event in queue after sleep')

  interpreter.stop()
  sandbox.restore()
})

test('mailbox address interpret smoke testing: 3 parallel EVENTs', async t => {
  const sandbox = sinon.createSandbox({
    useFakeTimers: true,
  })

  const mailbox = address(Baby.machine)
  const interpreter = interpret(mailbox)

  // console.info('initialState:', actor.initialState)
  interpreter
    .onTransition(x => {
      console.info('---------------- onTransition ----------------')
      console.info('  states  ->', x.value)
      console.info('  EVENT   ->', x.event.type)
      console.info('----------------------------------------------')
    })
    .start()

  let snapshot

  interpreter.send(Baby.events.SLEEP(10))
  snapshot = interpreter.getSnapshot()
  t.same(snapshot.value,  {
    router  : States.idle,
    message : States.idle,
    child   : States.busy,
  }, 'should be state.busy after received the 1st EVENT sleep')
  t.equal(snapshot.event.type, Baby.Types.DREAM, 'should send event child.Types.DREAM after received the 1st EVENT sleep')
  t.equal(snapshot.context.messageQueue.length, 0, 'should have 0 event in queue after received the 1st EVENT sleep')

  interpreter.send(Baby.events.SLEEP(20))
  snapshot = interpreter.getSnapshot()
  t.same(snapshot.value, {
    router  : States.idle,
    message : States.idle,
    child   : States.busy,
  }, 'should be state.busy after received the 2nd EVENT sleep')
  t.equal(snapshot.event.type, Types.NOTIFY, 'should trigger mailbox.events.NOTIFY after received the 2nd EVENT sleep')
  t.equal(snapshot.context.messageQueue.length, 1, 'should have 1 event in queue after received the 2nd EVENT sleep')

  interpreter.send(Baby.events.SLEEP(30))
  snapshot = interpreter.getSnapshot()
  t.same(snapshot.value, {
    router  : States.idle,
    message : States.idle,
    child   : States.busy,
  }, 'should be state.busy after received the 3rd EVENT sleep')
  t.equal(snapshot.event.type, Types.NOTIFY, 'should trigger mailbox.events.NOTIFY after received the 3rd EVENT sleep')
  t.equal(snapshot.context.messageQueue.length, 2, 'should have 1 event in queue after received the 3rd EVENT sleep')

  /**
   * Finish 1st (will right enter the 2nd)
   */
  await sandbox.clock.tickAsync(10)
  snapshot = interpreter.getSnapshot()
  t.same(snapshot.value,  {
    router  : States.idle,
    message : States.idle,
    child   : States.busy,
  }, 'should be state.busy after 10 ms')
  t.equal(snapshot.event.type, Baby.Types.DREAM, 'should right enter 2nd SLEEP after 10 ms')
  t.equal(snapshot.context.messageQueue.length, 1, 'should have 1 event in queue after 10 ms')

  /**
   * Finish 2nd
   */
  await sandbox.clock.tickAsync(20)
  snapshot = interpreter.getSnapshot()
  t.same(snapshot.value, {
    router  : States.idle,
    message : States.idle,
    child   : States.busy,
  }, 'should be state.busyafter another 20 ms')
  t.equal(snapshot.event.type, Baby.Types.DREAM, 'should right enter 3rd SLEEP after another 20 ms')
  t.equal(snapshot.context.messageQueue.length, 0, 'should have 0 event in queue after another 20 ms')

  /**
   * Finish 3rd
   */
  await sandbox.clock.tickAsync(30)
  snapshot = interpreter.getSnapshot()
  t.same(snapshot.value, {
    router  : States.idle,
    message : States.idle,
    child   : States.idle,
  }, 'should be state.idle after another 30 ms')
  t.equal(snapshot.event.type, Baby.Types.PLAY, 'should wakeup because there is no more SLEEP events after another 30 ms')
  t.equal(snapshot.context.messageQueue.length, 0, 'should have 0 event in queue after another 30 ms')

  // interpreter.stop()
  sandbox.restore()
})

test('mailbox address interpret smoke testing: 3 EVENTs with respond', async t => {
  const sandbox = sinon.createSandbox({
    useFakeTimers: true,
  })

  const mailbox = address(Baby.machine)
  const interpreter = interpret(mailbox)

  // console.info('initialState:', actor.initialState)
  interpreter
    .onTransition(x => {
      console.info('---------------- onTransition ----------------')
      console.info('  states  ->', x.value)
      console.info('  EVENT   ->', x.event.type)
      console.info('----------------------------------------------')
    })
    .start()

  let snapshot

  Array.from({ length: 3 }).forEach(_ => {
    console.info('EVENT: sleep sending...')
    interpreter.send(Baby.events.SLEEP(10))
    console.info('EVENT: sleep sending... done')
  })

  snapshot = interpreter.getSnapshot()
  t.same(snapshot.value, {
    router  : States.idle,
    message : States.idle,
    child   : States.busy,
  }, 'should be state.busy after received 3 sleep EVENTs')
  t.equal(snapshot.event.type, Types.NOTIFY, 'should trigger event NOTIFY after received 3 sleep EVENTs')
  t.equal(snapshot.context.messageQueue.length, 2, 'should have 2 event in queue after received 3 sleep EVENTs')

  await sandbox.clock.tickAsync(10)
  snapshot = interpreter.getSnapshot()
  t.same(snapshot.value, {
    router  : States.idle,
    message : States.idle,
    child   : States.busy,
  }, 'should be state.busy after 1st 10 ms')
  t.equal(snapshot.event.type, Baby.Types.DREAM, 'should enter next SLEEP(DREAM) after 1st 10 ms')
  t.equal(snapshot.context.messageQueue.length, 1, 'should have 1 event in queue after 1st 10 ms')

  await sandbox.clock.tickAsync(10)
  snapshot = interpreter.getSnapshot()
  t.same(snapshot.value, {
    router  : States.idle,
    message : States.idle,
    child   : States.busy,
  }, 'should be state.busy after 2nd 10 ms')
  t.equal(snapshot.event.type, Baby.Types.DREAM, 'should enter next SLEEP(DREAM) after 2nd 10 ms')
  t.equal(snapshot.context.messageQueue.length, 0, 'should have 0 event in queue after 2nd 10 ms')

  await sandbox.clock.tickAsync(10)
  snapshot = interpreter.getSnapshot()
  t.same(snapshot.value, {
    router  : States.idle,
    message : States.idle,
    child   : States.idle,
  }, 'should be state.idle after 3rd 10 ms')
  t.equal(snapshot.event.type, Baby.Types.PLAY, 'should receive event child.events.PLAY after 3rd 10 ms')
  t.equal(snapshot.context.messageQueue.length, 0, 'should have 0 event in queue after 3rd 10 ms')

  // interpreter.stop()
  sandbox.restore()
})

test('mailbox address proxy smoke testing', async t => {
  const sandbox = sinon.createSandbox({
    useFakeTimers: true,
  })

  const CHILD_ID = 'child'
  const childActor = address(Baby.machine)

  enum ParentStates {
    testing = 'testing',
  }
  enum ParentTypes {
    SLEEP = 'SLEEP',
  }

  const parentMachine = createMachine({
    id: 'parent',
    initial: ParentStates.testing,
    invoke: {
      id: CHILD_ID,
      src: childActor,
    },
    states: {
      [ParentStates.testing]: {
        on: {
          [ParentTypes.SLEEP]: {
            actions: [
              actions.send(Baby.events.SLEEP(10), { to: CHILD_ID }),
            ],
          },
        },
      },
    },
  })

  const interpreter = interpret(parentMachine)

  const transitionList: StateValue[]  = []
  const eventList:      string[]      = []

  interpreter.onEvent(e => {
    console.info('Received event', e)
    eventList.push(e.type)
  })
  interpreter.onTransition(s => {
    console.info('Transition to', s.value)
    transitionList.push(s.value)
  })

  interpreter.start()

  t.same(eventList, [
    'xstate.init',
  ], 'should have initial event list')
  t.same(transitionList, [
    ParentStates.testing,
  ], 'should have initial transition list')

  /**
   * 1st SLEEP
   */
  eventList.length = 0
  transitionList.length = 0
  interpreter.send(ParentTypes.SLEEP)
  t.same(eventList, [
    ParentTypes.SLEEP,
    Baby.Types.REST,
    Baby.Types.DREAM,
  ], 'should fall to sleep with events')
  t.same(transitionList,
    new Array(3).fill(ParentStates.testing),
    'should transition to states.sleeping 3 times (with 3 events)',
  )

  eventList.length = 0
  transitionList.length = 0
  await sandbox.clock.tickAsync(10)
  t.same(eventList, [
    Baby.Types.CRY,
    Baby.Types.PEE,
    Baby.Types.PLAY,
  ], 'should wakeup')
  t.same(transitionList,
    new Array(3).fill(ParentStates.testing),
    'should transition to states.sleeping 3 times (with 3 events)',
  )

  eventList.length = 0
  transitionList.length = 0
  Array.from({ length: 3 }).forEach(_ =>
    interpreter.send(ParentTypes.SLEEP),
  )
  t.same(eventList, [
    ParentTypes.SLEEP,
    Baby.Types.REST,
    Baby.Types.DREAM,
    ParentTypes.SLEEP,
    ParentTypes.SLEEP,
  ], 'should fall to sleep after 3 SLEEP events, with two more SLEEP event queued')

  eventList.length = 0
  await sandbox.clock.tickAsync(10)
  t.same(eventList, [
    Baby.Types.CRY,
    Baby.Types.PEE,
    Baby.Types.PLAY,
    Baby.Types.REST,
    Baby.Types.DREAM,
  ], 'should wakeup after 10 ms ,and fail sleep again')

  eventList.length = 0
  await sandbox.clock.tickAsync(10)
  t.same(eventList, [
    Baby.Types.CRY,
    Baby.Types.PEE,
    Baby.Types.PLAY,
    Baby.Types.REST,
    Baby.Types.DREAM,
  ], 'should wakeup after 10 ms ,and fail sleep again, twice')

  eventList.length = 0
  await sandbox.clock.tickAsync(10)
  t.same(eventList, [
    Baby.Types.CRY,
    Baby.Types.PEE,
    Baby.Types.PLAY,
  ], 'should wakeup another 10 ms, and no more SLEEP in the queue')

  eventList.length = 0
  await sandbox.clock.runAllAsync()
  t.same(eventList, [], 'should be no more EVENT mores')

  // interpreter.send(ParentTypes.STOP)
  interpreter.stop()
  sandbox.restore()
})
