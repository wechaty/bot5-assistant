#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/* eslint-disable sort-keys */
/* eslint-disable no-redeclare */

import { test, AssertEqual } from 'tstest'

import * as duck from '../duck/mod.js'

import { duckularize } from './duckularize.js'

const EXPECTED_DUCKULA = {

  ID: 'duckula-id',

  Event: {
    IDLE: duck.Event.IDLE,
    NEXT: duck.Event.NEXT,
  },

  State: {
    Idle: duck.State.Idle,
    Busy: duck.State.Busy,
  },

  Type: {
    IDLE: duck.Type.IDLE,
    NEXT: duck.Type.NEXT,
  },

  initialContext: () => ({ n: 42 }),
} as const

test('duckula() smoke testing', async t => {

  const duckula = duckularize({
    id: EXPECTED_DUCKULA.ID,
    events: [ duck.Event, [
      'IDLE',
      'NEXT',
    ] ],
    states: [
      duck.State, [
        'Idle',
        'Busy',
      ] ],
    initialContext: EXPECTED_DUCKULA.initialContext(),
  })

  t.same(duckula, EXPECTED_DUCKULA, 'should get the expected dockula')
})

test('duckula() typing smoke testing', async t => {

  const duckula = duckularize({
    id: EXPECTED_DUCKULA.ID,
    events: [ duck.Event, [
      'NEXT',
      'IDLE',
    ] ],
    states: [
      duck.State, [
        'Idle',
        'Busy',
      ] ],
    initialContext: EXPECTED_DUCKULA.initialContext(),
  })

  type Duckula = typeof duckula
  type Expected = typeof EXPECTED_DUCKULA

  const typingTest: AssertEqual<Duckula, Expected> = true
  t.ok(typingTest, 'should match typing')
})
