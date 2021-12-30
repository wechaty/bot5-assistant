#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/* eslint-disable sort-keys */

import {
  test,
}                   from 'tstest'
import type {
  ActorRef,
  GuardMeta,
  SCXML,
}                 from 'xstate'

import * as contexts from './contexts.js'
import { CHILD_MACHINE_ID } from './types.js'

test('assignEnqueue', async t => {
  const CONTEXT = contexts.initialContext()
  const EVENT = {
    type: 'test-type',
    [contexts.metaSymKey]: {
      origin: 'test-origin',
    },
  }

  t.equal(contexts.assignEnqueue.type, 'xstate.assign', 'should be in `assign` type')

  const queue = (contexts.assignEnqueue.assignment as any).queue(CONTEXT, EVENT, { _event: { origin: 'test-origin' }})
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

  const _EVENT = {
    origin: SESSION_ID,
  } as any as SCXML.Event<any>

  const CHILDREN: Record<string, ActorRef<any, any>> = {
    [CHILD_MACHINE_ID]: {
      sessionId: SESSION_ID,
    } as any as ActorRef<any, any>,
  }

  const META = {
    _event: _EVENT,
    state: { children: CHILDREN }
  } as GuardMeta<any, any>

  t.ok(contexts.condEventSentFromChild(META), 'should return true if the event origin is the child session id')

  META._event.origin = undefined
  t.notOk(contexts.condEventSentFromChild(META), 'should return false if the event origin is undefined')
})
