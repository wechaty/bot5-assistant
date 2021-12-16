#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/* eslint-disable sort-keys */

import {
  test,
  sinon,
}                   from 'tstest'

import {
  createMachine,
  interpret,
  actions,
  spawn,
  StateFrom,
  ContextFrom,
}                   from 'xstate'

import * as mailbox from './mailbox.js'

import * as child from './child-machine.fixture.js'

test('mailbox wrapped actor transition nextState smoke testing', async t => {
  const actor = mailbox.wrap(child.machine)

  // console.info('initialState:', actor.initialState)

  let nextState = actor.transition(actor.initialState, child.events.SLEEP(10))
  t.ok(nextState.actions.some(a => {
    return a.type === 'xstate.send' && a['event'].type === mailbox.types.DISPATCH
  }), 'should have triggered DISPATCH event by sending IDLE event')

  nextState = actor.transition(nextState, child.events.SLEEP(10))
  t.equal(nextState.context.queue.length, 2, 'should have 2 event in queue after sent two SLEEP event')
  t.same(nextState.context.queue.map(c => c.type), new Array(2).fill(child.types.SLEEP), 'should be both sleep event')
})

test('mailbox actor interpret smoke testing: 1 event', async t => {

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
  t.equal(snapshot.value, mailbox.states.idle, 'should stay at idle state after start')
  t.equal(snapshot.event.type, mailbox.types.IDLE, 'should received IDLE event from child after start')

  interpreter.send(child.events.SLEEP(10))
  snapshot = interpreter.getSnapshot()
  t.equal(snapshot.value, mailbox.states.busy, 'should be state.busy after received the 1st EVENT sleep')
  t.equal(snapshot.event.type, mailbox.types.DISPATCH, 'should send event DISPATCH after received the 1st EVENT sleep')
  t.equal(snapshot.context.queue.length, 0, 'should have 0 event in queue after received the 1st EVENT sleep')
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
  t.equal(snapshot.value, mailbox.states.busy, 'should be state.busy after received the 1st EVENT sleep')
  t.equal(snapshot.event.type, mailbox.types.DISPATCH, 'should send event DISPATCH after received the 1st EVENT sleep')
  t.equal(snapshot.context.queue.length, 0, 'should have 0 event in queue after received the 1st EVENT sleep')

  interpreter.send(child.events.SLEEP(20))
  snapshot = interpreter.getSnapshot()
  t.equal(snapshot.value, mailbox.states.busy, 'should be state.busy after received the 2nd EVENT sleep')
  t.equal(snapshot.event.type, mailbox.types.DISPATCH, 'should send event DISPATCH after received the 2nd EVENT sleep')
  t.equal(snapshot.context.queue.length, 1, 'should have 1 event in queue after received the 2nd EVENT sleep')

  interpreter.send(child.events.SLEEP(30))
  snapshot = interpreter.getSnapshot()
  t.equal(snapshot.value, mailbox.states.busy, 'should be state.busy after received the 3rd EVENT sleep')
  t.equal(snapshot.event.type, mailbox.types.DISPATCH, 'should send event DISPATCH after received the 3rd EVENT sleep')
  t.equal(snapshot.context.queue.length, 2, 'should have 1 event in queue after received the 3rd EVENT sleep')

  /**
   * Finish 1st
   */
  await sandbox.clock.tickAsync(10)
  snapshot = interpreter.getSnapshot()
  t.equal(snapshot.value, mailbox.states.busy, 'should be state.busy after 10 ms')
  t.equal(snapshot.event.type, mailbox.types.IDLE, 'should send event IDLE after 10 ms')
  t.equal(snapshot.context.queue.length, 1, 'should have 1 event in queue after 10 ms')

  /**
   * Finish 2nd
   */
  await sandbox.clock.tickAsync(20)
  snapshot = interpreter.getSnapshot()
  t.equal(snapshot.value, mailbox.states.busy, 'should be state.busy after another 20 ms')
  t.equal(snapshot.event.type, mailbox.types.IDLE, 'should send event IDLE after another 20 ms')
  t.equal(snapshot.context.queue.length, 0, 'should have 1 event in queue after another 20 ms')

  /**
   * Finish 3rd
   */
  await sandbox.clock.tickAsync(30)
  snapshot = interpreter.getSnapshot()
  t.equal(snapshot.value, mailbox.states.idle, 'should be state.idle after another 30 ms')
  t.equal(snapshot.event.type, mailbox.types.IDLE, 'should send event IDLE after another 30 ms')
  t.equal(snapshot.context.queue.length, 0, 'should have 1 event in queue after another 30 ms')

  interpreter.stop()
  sandbox.restore()
})

test.only('mailbox actor interpret smoke testing: 3 EVENTs with respond', async t => {
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
  t.equal(snapshot.value, mailbox.states.busy, 'should be state.busy after received 3 sleep EVENTs')
  t.equal(snapshot.event.type, mailbox.types.DISPATCH, 'should send event DISPATCH after received 3 sleep EVENTs')
  t.equal(snapshot.context.queue.length, 2, 'should have 2 event in queue after received 3 sleep EVENTs')

  await sandbox.clock.tickAsync(10)
  snapshot = interpreter.getSnapshot()
  t.equal(snapshot.value, mailbox.states.busy, 'should be state.busy after 1st 10 ms')
  t.equal(snapshot.event.type, mailbox.types.IDLE, 'should send event IDLE after 1st 10 ms')
  t.equal(snapshot.context.queue.length, 1, 'should have 1 event in queue after 1st 10 ms')

  await sandbox.clock.tickAsync(10)
  snapshot = interpreter.getSnapshot()
  t.equal(snapshot.value, mailbox.states.busy, 'should be state.busy after 2nd 10 ms')
  t.equal(snapshot.event.type, mailbox.types.IDLE, 'should send event IDLE after 2nd 10 ms')
  t.equal(snapshot.context.queue.length, 0, 'should have 0 event in queue after 2nd 10 ms')

  await sandbox.clock.tickAsync(10)
  snapshot = interpreter.getSnapshot()
  t.equal(snapshot.value, mailbox.states.idle, 'should be state.idle after 3rd 10 ms')
  t.equal(snapshot.event.type, mailbox.types.IDLE, 'should send event IDLE after 3rd 10 ms')
  t.equal(snapshot.context.queue.length, 0, 'should have 0 event in queue after 3rd 10 ms')

  interpreter.stop()
  sandbox.restore()
})
