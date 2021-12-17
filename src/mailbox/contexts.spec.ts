#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/* eslint-disable sort-keys */

import {
  test,
}                   from 'tstest'

import * as contexts from './contexts.js'

test('assignEnqueueMessage', async t => {
  const CONTEXT = contexts.initialContext()
  CONTEXT.currentEvent = {
    type: 'test-type',
    meta: {
      origin: 'test-origin',
    },
  }

  t.equal(contexts.assignEnqueueMessage.type, 'xstate.assign', 'should be in `assign` type')

  const messageQueue = contexts.assignEnqueueMessage.assignment.messageQueue(CONTEXT)
  t.same(messageQueue, [CONTEXT.currentEvent], 'should enqueue event to context.queue')
})

test('assignDequeueMessage', async t => {
  const EVENT = {
    type: 'test-type',
    meta: {
      origin: 'test-origin',
    },
  }

  const CONTEXT = contexts.initialContext()
  CONTEXT.messageQueue = [EVENT]

  t.equal(contexts.assignDequeueMessage.type, 'xstate.assign', 'should be in `assign` type')

  t.same(CONTEXT.messageQueue, [EVENT], 'should be one EVENT before dequeue event')
  const currentMessage = contexts.assignDequeueMessage.assignment.currentMessage(CONTEXT)
  t.same(currentMessage, EVENT, 'should be dequeue-ed event')
  t.same(CONTEXT.messageQueue, [], 'should be empty after dequeue event')
})

test('condMessageQueueNonempty', async t => {
  const EMPTY_CONTEXT = contexts.initialContext()

  const NONEMPTY_CONTEXT = contexts.initialContext()
  NONEMPTY_CONTEXT.messageQueue = [{} as any]

  t.notOk(contexts.condMessageQueueNonempty(EMPTY_CONTEXT), 'should be false when queue is empty')
  t.ok(contexts.condMessageQueueNonempty(NONEMPTY_CONTEXT), 'should be true when queue is nonempty')
})

test('condCurrentEventFromChild', async t => {
  const SESSION_ID = 'session-id'

  const context = contexts.initialContext()
  context.currentEvent = {
    meta: {
      origin: SESSION_ID,
    },
  } as any
  context.childRef = {
    sessionId: SESSION_ID,
  } as any

  t.ok(contexts.condCurrentEventFromChild(context), 'should return true if the event origin is the child session id')

  context.currentEvent!.meta.origin = undefined
  t.notOk(contexts.condCurrentEventFromChild(context), 'should return false if the event origin is undefined')
})
