#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/* eslint-disable sort-keys */

import {
  test,
}                   from 'tstest'
import type { ActorRef } from 'xstate'

import * as contexts from './contexts.js'
import { CHILD_MACHINE_ID } from './types.js'
import { Events } from './events.js'

test('assignEnqueue', async t => {
  const CONTEXT = contexts.initialContext()
  const EVENT = {
    type: 'test-type',
    [contexts.metaSymKey]: {
      origin: 'test-origin',
    },
  }
  const ENQUEUE_EVENT = Events.ENQUEUE(EVENT)

  t.equal(contexts.assignEnqueue.type, 'xstate.assign', 'should be in `assign` type')

  const queue = contexts.assignEnqueue.assignment.queue(CONTEXT, ENQUEUE_EVENT)
  t.same(queue, [EVENT], 'should enqueue event to context.queue')
})

test('queueSize()', async t => {
  const EMPTY_CONTEXT = contexts.initialContext()

  const NONEMPTY_CONTEXT = contexts.initialContext()
  NONEMPTY_CONTEXT.queue = [{} as any]

  t.equal(contexts.queueSize(EMPTY_CONTEXT), 0, 'should be empty when queue is empty')
  t.equal(contexts.queueSize(NONEMPTY_CONTEXT), 1, 'should be not empty when queue has one message')

  NONEMPTY_CONTEXT.index = 1
  t.equal(contexts.queueSize(NONEMPTY_CONTEXT), 0, 'should be empty when index set to 1')
})

test('assignEmptyQueue()', async t => {
  const queue = contexts.assignEmptyQueue.assignment.queue({} as any)
  t.same(queue, [], 'should be empty queue')
  const index = contexts.assignEmptyQueue.assignment.index({} as any)
  t.equal(index, 0, 'should be index 0')
})

test('assignDequeue()', async t => {
  const EVENT = {
    type: 'test-type',
    [contexts.metaSymKey]: {
      origin: 'test-origin',
    },
  }

  const CONTEXT = contexts.initialContext()
  CONTEXT.queue = [EVENT]

  t.same(CONTEXT.queue, [EVENT], 'should be one EVENT before dequeue event')
  const index = contexts.assignDequeue.assignment.index(CONTEXT, undefined, { _event: {} })
  t.same(CONTEXT.queue, [EVENT], 'should be one EVENT after dequeue event')
  t.equal(index, 1, 'should be at index 1 after dequeue event')
})

test('condRoutingEventOriginIsChild', async t => {
  const SESSION_ID = 'session-id'

  const context = contexts.initialContext()
  context.event = {
    [contexts.metaSymKey]: {
      origin: SESSION_ID,
    },
  } as any
  const children: Record<string, ActorRef<any, any>> = {
    [CHILD_MACHINE_ID]: {
      sessionId: SESSION_ID,
    } as any as ActorRef<any, any>,
  }

  t.ok(contexts.condRoutingEventOriginIsChild(context, children), 'should return true if the event origin is the child session id')

  context.event![contexts.metaSymKey].origin = undefined
  t.notOk(contexts.condRoutingEventOriginIsChild(context, children), 'should return false if the event origin is undefined')
})
