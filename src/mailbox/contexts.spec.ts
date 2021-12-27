#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/* eslint-disable sort-keys */

import {
  test,
}                   from 'tstest'
import type { ActorRef } from 'xstate'

import * as contexts from './contexts.js'
import { CHILD_MACHINE_ID } from './types.js'

test('assignEnqueue', async t => {
  const CONTEXT = contexts.initialContext()
  CONTEXT.event = {
    type: 'test-type',
    [contexts.metaSymKey]: {
      origin: 'test-origin',
    },
  }

  t.equal(contexts.assignEnqueue.type, 'xstate.assign', 'should be in `assign` type')

  const queue = contexts.assignEnqueue.assignment.queue(CONTEXT, undefined, { _event: {} })
  t.same(queue, [CONTEXT.event], 'should enqueue event to context.queue')
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
  const message = contexts.assignDequeue.assignment.message(CONTEXT, undefined, { _event: {} })
  t.equal(message, EVENT, 'should get the dequeue-ed event')
  t.same(CONTEXT.queue, [], 'should be empty after dequeue event')
})

test('empty()', async t => {
  const EMPTY_CONTEXT = contexts.initialContext()

  const NONEMPTY_CONTEXT = contexts.initialContext()
  NONEMPTY_CONTEXT.queue = [{} as any]

  t.equal(contexts.size(EMPTY_CONTEXT), 0, 'should be empty when queue is empty')
  t.equal(contexts.size(NONEMPTY_CONTEXT), 1, 'should be not empty when queue has one message')
})

test('condCurrentEventOriginIsChild', async t => {
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

  t.ok(contexts.condCurrentEventOriginIsChild(context, children), 'should return true if the event origin is the child session id')

  context.event![contexts.metaSymKey].origin = undefined
  t.notOk(contexts.condCurrentEventOriginIsChild(context, children), 'should return false if the event origin is undefined')
})
