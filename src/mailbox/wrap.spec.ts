#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/**
 *   Mailbox - https://github.com/huan/mailbox
 *    author: Huan LI (李卓桓) <zixia@zixia.net>
 *    Dec 2021
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */
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
  AnyEventObject,
  Interpreter,
  State,
}                   from 'xstate'

import { Types }    from './types.js'
import { States }   from './states.js'
import type { Events }   from './events.js'

import * as Baby   from './baby-machine.fixture.js'

import { wrap }  from './wrap.js'

test('wrap() transition nextState smoke testing', async t => {
  const mailbox = wrap(Baby.machine)

  // console.info('initialState:', actor.initialState)
  const SLEEP_EVENT = Baby.Events.SLEEP(10)

  let nextState = mailbox.transition(mailbox.initialState, SLEEP_EVENT)
  // console.info(nextState.actions)
  // console.info(nextState.context)
  t.same(
    nextState.actions
      .filter(a => a.type === 'xstate.send' && a['event'].type === Types.NEW_MESSAGE)
      .map(a => a['event'].type),
    [Types.NEW_MESSAGE],
    'should have NEW_MESSAGE event',
  )
  t.same(nextState.context.queue, [SLEEP_EVENT], 'should have no MESSAGE in queue')

  nextState = mailbox.transition(nextState, Baby.Events.SLEEP(10))
  // console.info(nextState.actions)
  t.equal(nextState.context.queue.length, 2, 'should have 0 event in queue after sent two SLEEP event')
  t.same(nextState.context.queue.map(c => c.type), new Array(2).fill(Baby.Types.SLEEP), 'should be both sleep event')
})

test('Mailbox.address interpret smoke testing: 1 event', async t => {
  const sandbox = sinon.createSandbox({
    useFakeTimers: true,
  })

  const mailboxAddress = wrap(Baby.machine)
  const interpreter = interpret(mailboxAddress)

  const eventList: AnyEventObject[] = []
  const stateList: State<any, any>[] = []

  interpreter.onEvent(e => eventList.push(e))
  interpreter.onTransition(s => stateList.push(s))
  interpreter.start()

  t.same(stateList[stateList.length - 1]?.value, {
    queue : States.listening,
    child : States.idle,
  }, 'should stay at idle state after start')
  t.same(stateList[stateList.length - 1]?.context, {
    queue: [],
    index: 0,
  }, 'should have initial context after start')
  t.same(eventList.map(e => e.type), [
    'xstate.init',
    Types.CHILD_IDLE,
    Types.CHILD_REPLY,
    Types.DISPATCH,
    Types.DEAD_LETTER,
  ], 'should received CHILD_RESPONSE with DEAD_LETTER event aftrer child sent IDLE')
  t.same(
    eventList
      .filter(e => e.type === Types.DEAD_LETTER)
      .map(e => (e as ReturnType<typeof Events.DEAD_LETTER>).payload.message.type),
    [Baby.Types.PLAY],
    'should received DEAD_LETTER with PLAY event',
  )

  stateList.length = eventList.length = 0
  interpreter.send(Baby.Events.SLEEP(10))
  let snapshot = interpreter.getSnapshot()

  t.same(stateList[stateList.length - 1]?.value, {
    queue   : States.listening,
    child   : States.busy,
  }, 'should be state.child.busy after received the 1st EVENT sleep')
  t.same(eventList.map(e => e.type), [
    Baby.Types.SLEEP,
    Types.NEW_MESSAGE,
    Types.DISPATCH,
    Types.DEQUEUE,
    Types.CHILD_REPLY,
    Types.CHILD_REPLY,
    Types.DEAD_LETTER,
    Types.DEAD_LETTER,
  ], 'should receive event [..., CHILD_RESPOND x 2, DEAD_LETTER x2, ...] after received the 1st EVENT sleep')
  t.same(
    eventList
      .filter(e => e.type === Types.DEAD_LETTER)
      .map(e => (e as ReturnType<typeof Events.DEAD_LETTER>).payload.message.type),
    [
      Baby.Types.REST,
      Baby.Types.DREAM,
    ],
    'should received DEAD_LETTER with REST and DREAM event',
  )
  // console.info(
  //   eventList
  //     .filter(e => e.type === Types.DEAD_LETTER)
  //     .map(e => (e as any).payload.event)
  // )
  t.equal(snapshot.context.queue.length, 0, 'should have 0 event in queue after received the 1st EVENT sleep')

  stateList.length = eventList.length = 0
  await sandbox.clock.tickAsync(9)
  snapshot = interpreter.getSnapshot()
  t.same(snapshot.value, {
    queue   : States.listening,
    child   : States.busy,
  }, 'should be state.busy after received the 1st EVENT sleep')
  t.equal(snapshot.context.queue.length, 0, 'should have 0 event in queue before wakeup')
  t.same(eventList.map(e => e.type), [
    Types.CHILD_REPLY,
    Types.DEAD_LETTER,
  ], 'should receive event child.Types.CRY after before wakeup')
  t.same(
    eventList
      .filter(e => e.type === Types.DEAD_LETTER)
      .map(e => (e as ReturnType<typeof Events.DEAD_LETTER>).payload.message.type),
    [
      Baby.Types.CRY,
    ],
    'should get one dead letter with CRY event after middle night',
  )

  stateList.length = eventList.length = 0
  await sandbox.clock.tickAsync(1)
  snapshot = interpreter.getSnapshot()
  t.same(snapshot.value, {
    queue   : States.listening,
    child   : States.idle,
  }, 'should be state.busy after received the 1st EVENT sleep')
  t.equal(snapshot.context.queue.length, 0, 'should have 0 event in queue after sleep')
  t.same(eventList.map(e => e.type), [
    Types.CHILD_REPLY,
    Types.DEAD_LETTER,
    Types.CHILD_IDLE,
    Types.DISPATCH,
    Types.CHILD_REPLY,
    Types.DEAD_LETTER,
  ], 'should receive event child.Types.PLAY after sleep')
  t.same(
    eventList
      .filter(e => e.type === Types.DEAD_LETTER)
      .map(e => (e as ReturnType<typeof Events.DEAD_LETTER>).payload.message.type),
    [
      Baby.Types.PEE,
      Baby.Types.PLAY,
    ],
    'should get one dead letter with PEE&PLAY event after sleep',
  )
  interpreter.stop()
  sandbox.restore()
})

test('mailbox address interpret smoke testing: 3 parallel EVENTs', async t => {
  const sandbox = sinon.createSandbox({
    useFakeTimers: true,
  })

  const mailbox = wrap(Baby.machine)
  const interpreter = interpret(mailbox)

  const eventList: AnyEventObject[] = []

  interpreter.onEvent(e => eventList.push(e))

  // console.info('initialState:', actor.initialState)
  interpreter.onTransition(x => {
    // console.info('---------------- onTransition ----------------')
    // console.info('  states  ->', x.value)
    // console.info('  EVENT   ->', x.event.type)
    // console.info('----------------------------------------------')
  })
  interpreter.start()

  let snapshot

  eventList.length = 0
  interpreter.send(Baby.Events.SLEEP(10))
  snapshot = interpreter.getSnapshot()
  t.same(snapshot.value,  {
    queue   : States.listening,
    child   : States.busy,
  }, 'should be state.busy after received the 1st EVENT sleep')
  t.same(eventList.map(e => e.type), [
    Baby.Types.SLEEP,
    Types.NEW_MESSAGE,
    Types.DISPATCH,
    Types.DEQUEUE,
    Types.CHILD_REPLY,
    Types.CHILD_REPLY,
    Types.DEAD_LETTER,
    Types.DEAD_LETTER,
  ], 'should send event child.Types.DREAM after received the 1st EVENT sleep')
  t.same(
    eventList
      .filter(e => e.type === Types.DEAD_LETTER)
      .map(e => (e as ReturnType<typeof Events.DEAD_LETTER>).payload.message.type),
    [
      Baby.Types.REST,
      Baby.Types.DREAM,
    ],
    'should received DEAD_LETTER with REST and DREAM event',
  )

  t.equal(snapshot.context.queue.length, 0, 'should have 0 event in queue after received the 1st EVENT sleep')

  interpreter.send(Baby.Events.SLEEP(20))
  snapshot = interpreter.getSnapshot()
  t.same(snapshot.value, {
    queue   : States.listening,
    child   : States.busy,
  }, 'should be state.busy after received the 2nd EVENT sleep')
  t.equal(snapshot.event.type, Types.NEW_MESSAGE, 'should trigger mailbox.events.NEW_MESSAGE after received the 2nd EVENT sleep')
  t.equal(snapshot.context.queue.length, 1, 'should have 1 event in queue after received the 2nd EVENT sleep')

  interpreter.send(Baby.Events.SLEEP(30))
  snapshot = interpreter.getSnapshot()
  t.same(snapshot.value, {
    queue   : States.listening,
    child   : States.busy,
  }, 'should be state.busy after received the 3rd EVENT sleep')
  t.equal(snapshot.event.type, Types.NEW_MESSAGE, 'should trigger mailbox.events.NEW_MESSAGE after received the 3rd EVENT sleep')
  t.equal(snapshot.context.queue.length, 2, 'should have 1 event in queue after received the 3rd EVENT sleep')

  /**
   * Finish 1st (will right enter the 2nd)
   */
  eventList.length = 0
  await sandbox.clock.tickAsync(10)
  snapshot = interpreter.getSnapshot()
  t.same(snapshot.value,  {
    queue   : States.listening,
    child   : States.busy,
  }, 'should be state.busy after 10 ms')
  t.same(eventList.map(e => e.type), [
    Types.CHILD_REPLY,
    Types.DEAD_LETTER,
    Types.CHILD_REPLY,
    Types.DEAD_LETTER,
    Types.CHILD_IDLE,
    Types.DISPATCH,
    Types.DEQUEUE,
    Types.CHILD_REPLY,
    Types.DEAD_LETTER,
    Types.CHILD_REPLY,
    Types.DEAD_LETTER,
    Types.CHILD_REPLY,
    Types.DEAD_LETTER,
  ], 'should right enter 2nd SLEEP after 10 ms')
  // console.info('#### queue:', snapshot.context.queue)
  t.equal(snapshot.context.queue.length, 2, 'should have 2 event in queue after 10 ms')
  t.same(
    eventList
      .filter(e => e.type === Types.DEAD_LETTER)
      .map(e => (e as ReturnType<typeof Events.DEAD_LETTER>).payload.message.type),
    [
      Baby.Types.CRY,
      Baby.Types.PEE,
      Baby.Types.PLAY,
      Baby.Types.REST,
      Baby.Types.DREAM,
    ],
    'should received DEAD_LETTER with Baby events',
  )

  /**
   * Finish 2nd
   */
  eventList.length = 0
  await sandbox.clock.tickAsync(20)
  snapshot = interpreter.getSnapshot()
  t.same(snapshot.value, {
    queue   : States.listening,
    child   : States.busy,
  }, 'should be state.busyafter another 20 ms')
  t.same(eventList.map(e => e.type), [
    Types.CHILD_REPLY,
    Types.DEAD_LETTER,
    Types.CHILD_REPLY,
    Types.DEAD_LETTER,
    Types.CHILD_IDLE,
    Types.DISPATCH,
    Types.DEQUEUE,
    Types.CHILD_REPLY,
    Types.DEAD_LETTER,
    Types.CHILD_REPLY,
    Types.DEAD_LETTER,
    Types.CHILD_REPLY,
    Types.DEAD_LETTER,
  ], 'should right enter 3rd SLEEP after another 20 ms')
  t.equal(snapshot.context.queue.length, 0, 'should have 0 event in queue after another 20 ms')
  t.same(
    eventList
      .filter(e => e.type === Types.DEAD_LETTER)
      .map(e => (e as ReturnType<typeof Events.DEAD_LETTER>).payload.message.type),
    [
      Baby.Types.CRY,
      Baby.Types.PEE,
      Baby.Types.PLAY,
      Baby.Types.REST,
      Baby.Types.DREAM,
    ],
    'should received DEAD_LETTER with Baby events',
  )

  /**
   * Finish 3rd
   */
  await sandbox.clock.tickAsync(30)
  snapshot = interpreter.getSnapshot()
  t.same(snapshot.value, {
    queue   : States.listening,
    child   : States.idle,
  }, 'should be state.idle after another 30 ms')
  t.equal(snapshot.event.type, Types.DEAD_LETTER, 'should wakeup because there is no more SLEEP events after another 30 ms')
  t.equal(snapshot.context.queue.length, 0, 'should have 0 event in queue after another 30 ms')

  // interpreter.stop()
  sandbox.restore()
})

test('mailbox address interpret smoke testing: 3 EVENTs with respond', async t => {
  const sandbox = sinon.createSandbox({
    useFakeTimers: true,
  })

  const mailbox = wrap(Baby.machine)
  const interpreter = interpret(mailbox)

  const eventList: AnyEventObject[] = []
  interpreter.onEvent(e => eventList.push(e))
  // console.info('initialState:', actor.initialState)
  interpreter.onTransition(x => {
    // console.info('---------------- onTransition ----------------')
    // console.info('  states  ->', x.value)
    // console.info('  EVENT   ->', x.event.type)
    // console.info('----------------------------------------------')
  })
  interpreter.start()

  let snapshot

  Array.from({ length: 3 }).forEach(_ => {
    // console.info('EVENT: sleep sending...')
    interpreter.send(Baby.Events.SLEEP(10))
    // console.info('EVENT: sleep sending... done')
  })

  snapshot = interpreter.getSnapshot()
  t.same(snapshot.value, {
    queue   : States.listening,
    child   : States.busy,
  }, 'should be state.busy after received 3 sleep EVENTs')
  t.equal(snapshot.event.type, Types.NEW_MESSAGE, 'should trigger event NEW_MESSAGE after received 3 sleep EVENTs')
  t.equal(snapshot.context.queue.length, 2, 'should have 2 event in queue after received 3 sleep EVENTs')

  eventList.length = 0
  await sandbox.clock.tickAsync(10)
  snapshot = interpreter.getSnapshot()
  t.same(snapshot.value, {
    queue   : States.listening,
    child   : States.busy,
  }, 'should be state.busy after 1st 10 ms')
  // console.info(eventList)
  t.same(
    eventList
      .filter(e => e.type === Types.DEAD_LETTER)
      .map(e => (e as ReturnType<typeof Events.DEAD_LETTER>).payload.message.type)
      .filter(t => Object.values<string>(Baby.Types).includes(t)),
    [
      Baby.Types.CRY,
      Baby.Types.PEE,
      Baby.Types.PLAY,
      Baby.Types.REST,
      Baby.Types.DREAM,
    ],
    'should enter next SLEEP(DREAM) after 1st 10 ms',
  )
  t.equal(snapshot.context.queue.length, 2, 'should have 2 event in queue after 1st 10 ms')

  eventList.length = 0
  await sandbox.clock.tickAsync(10)
  snapshot = interpreter.getSnapshot()
  t.same(snapshot.value, {
    queue   : States.listening,
    child   : States.busy,
  }, 'should be state.busy after 2nd 10 ms')
  t.same(
    eventList
    .filter(e => e.type === Types.DEAD_LETTER)
    .map(e => (e as ReturnType<typeof Events.DEAD_LETTER>).payload.message.type)
    .filter(t => Object.values<string>(Baby.Types).includes(t)),
    [
      Baby.Types.CRY,
      Baby.Types.PEE,
      Baby.Types.PLAY,
      Baby.Types.REST,
      Baby.Types.DREAM,
    ],
    'should enter next SLEEP(DREAM) after 2nd 10 ms',
  )
  t.equal(snapshot.context.queue.length, 0, 'should have 0 event in queue after 2nd 10 ms')

  eventList.length = 0
  await sandbox.clock.tickAsync(10)
  snapshot = interpreter.getSnapshot()
  t.same(snapshot.value, {
    queue   : States.listening,
    child   : States.idle,
  }, 'should be state.idle after 3rd 10 ms')
  t.same(
    eventList
    .filter(e => e.type === Types.DEAD_LETTER)
    .map(e => (e as ReturnType<typeof Events.DEAD_LETTER>).payload.message.type)
    .filter(t => Object.values<string>(Baby.Types).includes(t)),
    [
      Baby.Types.CRY,
      Baby.Types.PEE,
      Baby.Types.PLAY,
    ],
    'should receive event child.events.PLAY after 3rd 10 ms',
  )
  t.equal(snapshot.context.queue.length, 0, 'should have 0 event in queue after 3rd 10 ms')

  interpreter.stop()
  sandbox.restore()
})

test('Mailbox.address proxy smoke testing', async t => {
  const sandbox = sinon.createSandbox({
    useFakeTimers: true,
  })

  const CHILD_ID = 'child'
  const childActor = wrap(Baby.machine)

  enum ParentStates {
    testing = 'testing',
  }
  enum ParentTypes {
    TEST = 'TEST',
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
          [ParentTypes.TEST]: {
            actions: [
              actions.send(Baby.Events.SLEEP(10), { to: CHILD_ID }),
            ],
          },
        },
      },
    },
  })

  const interpreter = interpret(parentMachine)

  const stateList: StateValue[]  = []
  const eventList: string[]      = []

  interpreter.onEvent(e       => eventList.push(e.type))
  interpreter.onTransition(s  => stateList.push(s.value))

  interpreter.start()

  // console.info(interpreter.children)
  const mailboxAddress = (interpreter.children.get(CHILD_ID) as any as Interpreter<any>)
  mailboxAddress.onEvent((e: any) => {
    if (e.type === Types.DEAD_LETTER) {
      console.error('DEAD_LETTER', e.payload.event)
      console.error('DEAD_LETTER', mailboxAddress.getSnapshot().context.message)
    }
  })

  t.same(eventList, [
    'xstate.init',
  ], 'should have initial event list')
  t.same(stateList, [
    ParentStates.testing,
  ], 'should have initial transition list')

  /**
   * 1st SLEEP
   */
  eventList.length = stateList.length = 0
  interpreter.send(ParentTypes.TEST)
  t.same(eventList, [
    ParentTypes.TEST,
    Baby.Types.REST,
    Baby.Types.DREAM,
  ], 'should fall to sleep with events')
  t.same(stateList, new Array(3).fill(ParentStates.testing),
    'should transition to states.sleeping 3 times (with 3 events)',
  )

  eventList.length = stateList.length = 0
  await sandbox.clock.tickAsync(10)
  t.same(eventList, [
    Baby.Types.CRY,
    Baby.Types.PEE,
    Baby.Types.PLAY,
  ], 'should wakeup')
  t.same(stateList,
    new Array(3).fill(ParentStates.testing),
    'should transition to states.sleeping 3 times (with 3 events)',
  )

  eventList.length = stateList.length = 0
  Array.from({ length: 3 }).forEach(_ =>
    interpreter.send(ParentTypes.TEST),
  )
  t.same(eventList, [
    ParentTypes.TEST,
    Baby.Types.REST,
    Baby.Types.DREAM,
    ParentTypes.TEST,
    ParentTypes.TEST,
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

  interpreter.stop()
  sandbox.restore()
})
