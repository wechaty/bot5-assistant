#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/* eslint-disable sort-keys */

import {
  test,
}                   from 'tstest'

import * as contexts from './contexts.js'

test('assignEnqueue', async t => {
  const CONTEXT = contexts.initialContext()
  CONTEXT.event = {
    type: 'test-type',
    [contexts.metaSymKey]: {
      origin: 'test-origin',
    },
  }

  t.equal(contexts.assignEnqueue.type, 'xstate.assign', 'should be in `assign` type')

  const messages = contexts.assignEnqueue.assignment.messages(CONTEXT, undefined, { _event: {} })
  t.same(messages, [CONTEXT.event], 'should enqueue event to context.queue')
})

test('dequeue()', async t => {
  const EVENT = {
    type: 'test-type',
    [contexts.metaSymKey]: {
      origin: 'test-origin',
    },
  }

  const CONTEXT = contexts.initialContext()
  CONTEXT.messages = [EVENT]

  t.same(CONTEXT.messages, [EVENT], 'should be one EVENT before dequeue event')
  t.equal(contexts.dequeue(CONTEXT), EVENT, 'should get the dequeue-ed event')
  t.same(CONTEXT.messages, [], 'should be empty after dequeue event')
})

test('size()', async t => {
  const EMPTY_CONTEXT = contexts.initialContext()

  const NONEMPTY_CONTEXT = contexts.initialContext()
  NONEMPTY_CONTEXT.messages = [{} as any]

  t.equal(contexts.size(EMPTY_CONTEXT), 0, 'should be 0 when queue is empty')
  t.equal(contexts.size(NONEMPTY_CONTEXT), 1., 'should be 1 when queue has one message')
})

test('condEventOriginIsChild', async t => {
  const SESSION_ID = 'session-id'

  const context = contexts.initialContext()
  context.event = {
    [contexts.metaSymKey]: {
      origin: SESSION_ID,
    },
  } as any
  context.childRef = {
    sessionId: SESSION_ID,
  } as any

  t.ok(contexts.condEventOriginIsChild(context), 'should return true if the event origin is the child session id')

  context.event![contexts.metaSymKey].origin = undefined
  t.notOk(contexts.condEventOriginIsChild(context), 'should return false if the event origin is undefined')
})
