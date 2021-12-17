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
}                   from 'xstate'

import * as mailbox from './mailbox.js'
import * as child   from './baby-machine.fixture.js'

test('mailbox wrapped actor transition nextState smoke testing', async t => {
  const actor = mailbox.wrap(child.machine)

  // console.info('initialState:', actor.initialState)

  let nextState = actor.transition(actor.initialState, child.events.SLEEP(10))
  console.info(nextState.actions)
  t.ok(nextState.actions.some(a => {
    return a.type === 'xstate.send' && a['event'].type === mailbox.types.NOTIFY
  }), 'should have triggered NOTIFY event by sending IDLE event')

  nextState = actor.transition(nextState, child.events.SLEEP(10))
  t.equal(nextState.context.messageQueue.length, 2, 'should have 2 event in queue after sent two SLEEP event')
  t.same(nextState.context.messageQueue.map(c => c.type), new Array(2).fill(child.types.SLEEP), 'should be both sleep event')
})

test('mailbox actor interpret smoke testing: 1 event', async t => {
  const sandbox = sinon.createSandbox({
    useFakeTimers: true,
  })

  const actor = mailbox.wrap(child.machine)
  const interpreter = interpret(actor)

  interpreter
    .onTransition(x => {
      console.info('onTransition: ')
      console.info('  - states:', x.value)
      console.info('  - event:', x.event.type)
      console.info('----------------')
    })
    .start()

  let snapshot = interpreter.getSnapshot()
  // console.info('snapshot:', snapshot)
  t.same(snapshot.value, {
    router  : mailbox.states.idle,
    message : mailbox.states.idle,
    child   : mailbox.states.idle,
  }, 'should stay at idle state after start')
  t.equal(snapshot.event.type, mailbox.types.DISPATCH, 'should received DISPATCH event aftrer child sent IDLE')

  interpreter.send(child.events.SLEEP(10))
  snapshot = interpreter.getSnapshot()
  t.same(snapshot.value, {
    router  : mailbox.states.idle,
    message : mailbox.states.idle,
    child   : mailbox.states.busy,
  }, 'should be state.busy after received the 1st EVENT sleep')
  t.equal(snapshot.event.type, child.types.DREAM, 'should receive event child.types.DREAM after received the 1st EVENT sleep')
  t.equal(snapshot.context.messageQueue.length, 0, 'should have 0 event in queue after received the 1st EVENT sleep')

  await sandbox.clock.tickAsync(9)
  snapshot = interpreter.getSnapshot()
  t.same(snapshot.value, {
    router  : mailbox.states.idle,
    message : mailbox.states.idle,
    child   : mailbox.states.busy,
  }, 'should be state.busy after received the 1st EVENT sleep')
  t.equal(snapshot.event.type, child.types.CRY, 'should receive event child.types.CRY after before wakeup')
  t.equal(snapshot.context.messageQueue.length, 0, 'should have 0 event in queue before wakeup')

  await sandbox.clock.tickAsync(1)
  snapshot = interpreter.getSnapshot()
  t.same(snapshot.value, {
    router  : mailbox.states.idle,
    message : mailbox.states.idle,
    child   : mailbox.states.idle,
  }, 'should be state.busy after received the 1st EVENT sleep')
  t.equal(snapshot.event.type, child.types.PLAY, 'should receive event child.types.PLAY after sleep')
  t.equal(snapshot.context.messageQueue.length, 0, 'should have 0 event in queue after sleep')
})

test('mailbox actor interpret smoke testing: 3 parallel EVENTs', async t => {
  const sandbox = sinon.createSandbox({
    useFakeTimers: true,
  })

  const actor = mailbox.wrap(child.machine)
  const interpreter = interpret(actor)

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

  interpreter.send(child.events.SLEEP(10))
  snapshot = interpreter.getSnapshot()
  t.same(snapshot.value,  {
    router  : mailbox.states.idle,
    message : mailbox.states.idle,
    child   : mailbox.states.busy,
  }, 'should be state.busy after received the 1st EVENT sleep')
  t.equal(snapshot.event.type, child.types.DREAM, 'should send event child.types.DREAM after received the 1st EVENT sleep')
  t.equal(snapshot.context.messageQueue.length, 0, 'should have 0 event in queue after received the 1st EVENT sleep')

  interpreter.send(child.events.SLEEP(20))
  snapshot = interpreter.getSnapshot()
  t.same(snapshot.value, {
    router  : mailbox.states.idle,
    message : mailbox.states.idle,
    child   : mailbox.states.busy,
  }, 'should be state.busy after received the 2nd EVENT sleep')
  t.equal(snapshot.event.type, mailbox.types.NOTIFY, 'should trigger mailbox.events.NOTIFY after received the 2nd EVENT sleep')
  t.equal(snapshot.context.messageQueue.length, 1, 'should have 1 event in queue after received the 2nd EVENT sleep')

  interpreter.send(child.events.SLEEP(30))
  snapshot = interpreter.getSnapshot()
  t.same(snapshot.value, {
    router  : mailbox.states.idle,
    message : mailbox.states.idle,
    child   : mailbox.states.busy,
  }, 'should be state.busy after received the 3rd EVENT sleep')
  t.equal(snapshot.event.type, mailbox.types.NOTIFY, 'should trigger mailbox.events.NOTIFY after received the 3rd EVENT sleep')
  t.equal(snapshot.context.messageQueue.length, 2, 'should have 1 event in queue after received the 3rd EVENT sleep')

  /**
   * Finish 1st (will right enter the 2nd)
   */
  await sandbox.clock.tickAsync(10)
  snapshot = interpreter.getSnapshot()
  t.same(snapshot.value,  {
    router  : mailbox.states.idle,
    message : mailbox.states.idle,
    child   : mailbox.states.busy,
  }, 'should be state.busy after 10 ms')
  t.equal(snapshot.event.type, child.types.DREAM, 'should right enter 2nd SLEEP after 10 ms')
  t.equal(snapshot.context.messageQueue.length, 1, 'should have 1 event in queue after 10 ms')

  /**
   * Finish 2nd
   */
  await sandbox.clock.tickAsync(20)
  snapshot = interpreter.getSnapshot()
  t.same(snapshot.value, {
    router  : mailbox.states.idle,
    message : mailbox.states.idle,
    child   : mailbox.states.busy,
  }, 'should be state.busyafter another 20 ms')
  t.equal(snapshot.event.type, child.types.DREAM, 'should right enter 3rd SLEEP after another 20 ms')
  t.equal(snapshot.context.messageQueue.length, 0, 'should have 0 event in queue after another 20 ms')

  /**
   * Finish 3rd
   */
  await sandbox.clock.tickAsync(30)
  snapshot = interpreter.getSnapshot()
  t.same(snapshot.value, {
    router  : mailbox.states.idle,
    message : mailbox.states.idle,
    child   : mailbox.states.idle,
  }, 'should be state.idle after another 30 ms')
  t.equal(snapshot.event.type, child.types.PLAY, 'should wakeup because there is no more SLEEP events after another 30 ms')
  t.equal(snapshot.context.messageQueue.length, 0, 'should have 0 event in queue after another 30 ms')

  // interpreter.stop()
  sandbox.restore()
})

test('mailbox actor interpret smoke testing: 3 EVENTs with respond', async t => {
  const sandbox = sinon.createSandbox({
    useFakeTimers: true,
  })

  const actor = mailbox.wrap(child.machine)
  const interpreter = interpret(actor)

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
    interpreter.send(child.events.SLEEP(10))
    console.info('EVENT: sleep sending... done')
  })

  snapshot = interpreter.getSnapshot()
  t.same(snapshot.value, {
    router  : mailbox.states.idle,
    message : mailbox.states.idle,
    child   : mailbox.states.busy,
  }, 'should be state.busy after received 3 sleep EVENTs')
  t.equal(snapshot.event.type, mailbox.types.NOTIFY, 'should trigger event NOTIFY after received 3 sleep EVENTs')
  t.equal(snapshot.context.messageQueue.length, 2, 'should have 2 event in queue after received 3 sleep EVENTs')

  await sandbox.clock.tickAsync(10)
  snapshot = interpreter.getSnapshot()
  t.same(snapshot.value, {
    router  : mailbox.states.idle,
    message : mailbox.states.idle,
    child   : mailbox.states.busy,
  }, 'should be state.busy after 1st 10 ms')
  t.equal(snapshot.event.type, child.types.DREAM, 'should enter next SLEEP(DREAM) after 1st 10 ms')
  t.equal(snapshot.context.messageQueue.length, 1, 'should have 1 event in queue after 1st 10 ms')

  await sandbox.clock.tickAsync(10)
  snapshot = interpreter.getSnapshot()
  t.same(snapshot.value, {
    router  : mailbox.states.idle,
    message : mailbox.states.idle,
    child   : mailbox.states.busy,
  }, 'should be state.busy after 2nd 10 ms')
  t.equal(snapshot.event.type, child.types.DREAM, 'should enter next SLEEP(DREAM) after 2nd 10 ms')
  t.equal(snapshot.context.messageQueue.length, 0, 'should have 0 event in queue after 2nd 10 ms')

  await sandbox.clock.tickAsync(10)
  snapshot = interpreter.getSnapshot()
  t.same(snapshot.value, {
    router  : mailbox.states.idle,
    message : mailbox.states.idle,
    child   : mailbox.states.idle,
  }, 'should be state.idle after 3rd 10 ms')
  t.equal(snapshot.event.type, child.types.PLAY, 'should receive event child.events.PLAY after 3rd 10 ms')
  t.equal(snapshot.context.messageQueue.length, 0, 'should have 0 event in queue after 3rd 10 ms')

  // interpreter.stop()
  sandbox.restore()
})

test('mailbox proxy smoke testing', async t => {
  const sandbox = sinon.createSandbox({
    useFakeTimers: true,
  })

  const CHILD_ID = 'child'
  const childActor = mailbox.wrap(child.machine)

  const parentMachine = createMachine({
    id: 'parent',
    initial: 'testing',
    invoke: {
      id: CHILD_ID,
      src: childActor,
    },
    on: {
      '*': {
        actions: actions.choose([
          {
            cond: (_, e) => Object.values(child.types).includes(e.type as any),
            actions: [
              actions.send((_, e) => e, { to: CHILD_ID }),
            ],
          },
        ]),
      },
    },
    states: {
      testing: {},
    },
  })

  const interpreter = interpret(parentMachine)

  const eventList: string[] = []

  interpreter.onTransition(s => {
    eventList.push(s.event.type)

    console.info('----- onTransition: -----')
    console.info('  - states:', s.value)
    console.info('  - event:', s.event.type)
    console.info('----------------------------------------------')
  })

  interpreter.start()

  t.same(eventList, [
    'xstate.init',
    child.types.PLAY,
  ], 'should have initial event list')

  eventList.length = 0
  interpreter.send(child.events.SLEEP(10))
  t.same(eventList, [
    child.types.SLEEP,
    child.types.EAT,
    child.types.REST,
    child.types.DREAM,
  ], 'should fail to sleep')

  eventList.length = 0
  await sandbox.clock.tickAsync(10)
  t.same(eventList, [
    child.types.CRY,
    child.types.PEE,
    child.types.PLAY,
  ], 'should wakeup')

  eventList.length = 0
  Array.from({ length: 3 }).forEach(_ =>
    interpreter.send(child.events.SLEEP(10)),
  )
  t.same(eventList, [
    child.types.SLEEP,
    child.types.EAT,
    child.types.REST,
    child.types.DREAM,
    child.types.SLEEP,
    child.types.SLEEP,
  ], 'should fail to sleep after 3 SLEEP events, with two more SLEEP event queued')

  eventList.length = 0
  await sandbox.clock.tickAsync(10)
  t.same(eventList, [
    child.types.CRY,
    child.types.PEE,
    child.types.PLAY,
    child.types.EAT,
    child.types.REST,
    child.types.DREAM,
  ], 'should wakeup after 10 ms ,and fail sleep again')

  eventList.length = 0
  await sandbox.clock.tickAsync(10)
  t.same(eventList, [
    child.types.CRY,
    child.types.PEE,
    child.types.PLAY,
    child.types.EAT,
    child.types.REST,
    child.types.DREAM,
  ], 'should wakeup after 10 ms ,and fail sleep again, twice')

  eventList.length = 0
  await sandbox.clock.tickAsync(10)
  t.same(eventList, [
    child.types.CRY,
    child.types.PEE,
    child.types.PLAY,
  ], 'should wakeup another 10 ms, and no more SLEEP in the queue')

  eventList.length = 0
  await sandbox.clock.runAllAsync()
  t.same(eventList, [], 'should be no more EVENT mores')

  sandbox.restore()
})
