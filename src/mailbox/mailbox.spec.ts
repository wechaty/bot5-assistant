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
}                   from 'xstate'
import { createFixture } from 'wechaty-mocker'

import * as mailbox from './mailbox.js'

const MAX_DELAY = 15 * 1000

const childMachine = createMachine({
  id: 'child',
  initial: 'idle',
  states: {
    idle: {
      entry: [
        actions.log('[child] entry idle state'),
        actions.sendParent(mailbox.events.IDLE()),
      ],
      on: {
        ding: {
          target: 'busy',
          actions: [
            actions.log(_ => '[child] received ding'),
          ],
        },
      },
      exit: [
        actions.log('[child] exit idle state'),
      ],
    },
    busy: {
      entry: [
        actions.log((_, e) => `[child] ding(${e.n}) entry busy state`),
      ],
      after: {
        randomDelay: 'idle',
      },
      exit: [
        actions.log((_, e) => '[child] ding() exit busy state'),
      ],
    },
  },
}, {
  delays: {
    randomDelay: () => {
      const ms = Math.floor(Math.random() * MAX_DELAY)
      console.info('random delay: %dms', ms)
      return ms
    },
  },
})

test('mailbox actor transition smoke testing', async t => {

  const actor = mailbox.wrap(childMachine)

  // console.info('initialState:', actor.initialState)

  let nextState = actor.transition(actor.initialState, 'ding')
  t.ok(nextState.actions.some(a => {
    return a.type === 'xstate.send' && a['event'].type === mailbox.types.DISPATCH
  }), 'should have send action after init')

  nextState = actor.transition(nextState, 'ding')
  console.info('queue:', nextState.context.queue)
  t.equal(nextState.context.queue.length, 2, 'should have 2 event in queue')
  t.same(nextState.context.queue.map(c => c.type), ['ding', 'ding'], 'should be both ding event')
})

test.only('mailbox actor interpret smoke testing', async t => {

  const actor = mailbox.wrap(childMachine)
  const interpreter = interpret(actor)

  // console.info('initialState:', actor.initialState)
  interpreter
    .onTransition(x => console.info(x.value, x.event.type))
    .start()

  for (let i = 0; i < 5; i++) {
    console.info('sending ding ', i)
    interpreter.send({
      type: 'ding',
      n: i,
    })
  }

  let snapshot = interpreter.getSnapshot()
  // console.info('snapshot:', snapshot)
  // t.equal(nextState.context.queue.length, 2, 'should have 2 event in queue')
  // t.same(nextState.context.queue.map(c => c.type), ['ding', 'ding'], 'should be both ding event')

  // interpreter.stop()
})
