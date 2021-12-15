#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/* eslint-disable sort-keys */

import {
  test,
}                   from 'tstest'

import * as contexts from './contexts.js'

test('contexts.enqueue()', async t => {
  const CONTEXT: contexts.Context = {
    actorRef: null,
    current: null,
    queue: [],
  }
  const EVENT = {
    type: 'test-type',
  }
  const ORIGIN = 'test-origin'

  const enqueueAssignAction = contexts.enqueue()
  t.equal(enqueueAssignAction.type, 'xstate.assign', 'should be in `assign` type')

  const queue = enqueueAssignAction.assignment.queue(CONTEXT, EVENT, { _event: { origin: ORIGIN } })

  t.same(queue, [{
    ...EVENT,
    meta: {
      origin: ORIGIN,
    },
  }], 'should enqueue event to context.queue')
})

test('contexts.dequeue()', async t => {
  const EVENT = {
    type: 'test-type',
  }
  const ORIGIN = 'test-origin'
  const CONTEXT: contexts.Context = {
    actorRef: null,
    current: null,
    queue: [{
      ...EVENT,
      meta: {
        origin: ORIGIN,
      },
    }],
  }

  const dequeueAssignaction = contexts.dequeue()
  t.equal(dequeueAssignaction.type, 'xstate.assign', 'should be in `assign` type')

  const current = dequeueAssignaction.assignment.current(CONTEXT, EVENT, { _event: { origin: ORIGIN } })

  t.same(current, {
    ...EVENT,
    meta: {
      origin: ORIGIN,
    },
  }, 'should be dequeue-ed event')
  t.same(CONTEXT.queue, [], 'should be empty after dequeue event')
})

test('contexts.nonempty()', async t => {
  const EMPTY_CONTEXT: contexts.Context = {
    actorRef: null,
    current: null,
    queue: [],
  }
  const NONEMPTY_CONTEXT: contexts.Context = {
    actorRef: null,
    current: null,
    queue: [{} as any],
  }

  t.equal(contexts.nonempty()(EMPTY_CONTEXT), false, 'should be false when queue is empty')
  t.equal(contexts.nonempty()(NONEMPTY_CONTEXT), true, 'should be false when queue is nonempty')
})
