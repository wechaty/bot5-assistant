#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/* eslint-disable sort-keys */
/* eslint-disable no-redeclare */

import { test, AssertEqual } from 'tstest'

import * as duck from '../duck/mod.js'

import { duckularize } from './duckularize.js'

const FIXTURE = {

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

test('duckularize() smoke testing', async t => {

  const duckula = duckularize({
    id: FIXTURE.ID,
    events: [ duck.Event, [
      'IDLE',
      'NEXT',
    ] ],
    states: [
      duck.State, [
        'Idle',
        'Busy',
      ] ],
    initialContext: FIXTURE.initialContext(),
  })

  t.same(
    JSON.parse(JSON.stringify(duckula)),
    JSON.parse(JSON.stringify(FIXTURE)),
    'should get the expected dockula',
  )
})

test('duckularize() typing smoke testing', async t => {

  const duckula = duckularize({
    id: FIXTURE.ID,
    events: [ duck.Event, [
      'NEXT',
      'IDLE',
    ] ],
    states: [
      duck.State, [
        'Idle',
        'Busy',
      ] ],
    initialContext: FIXTURE.initialContext(),
  })

  type Duckula = typeof duckula
  type Expected = typeof FIXTURE

  const typingTest: AssertEqual<Duckula, Expected> = true
  t.ok(typingTest, 'should match typing')
})

test('duckularize() value for events & states with object param (without array selector)', async t => {

  const duckula = duckularize({
    id: FIXTURE.ID,
    events: FIXTURE.Event,
    states: FIXTURE.State,
    initialContext: FIXTURE.initialContext(),
  })

  const EXPECTED_DUCKULA = {
    ...FIXTURE,
    Event: FIXTURE.Event,
    State: FIXTURE.State,
    Type: FIXTURE.Type,
  }

  t.same(
    JSON.parse(JSON.stringify(duckula)),
    JSON.parse(JSON.stringify(EXPECTED_DUCKULA)),
    'should get the expected dockula',
  )
})

test('duckularize() typing for events & states with object param (without array selector)', async t => {

  const duckula = duckularize({
    id: FIXTURE.ID,
    events: FIXTURE.Event,
    states: FIXTURE.State,
    initialContext: FIXTURE.initialContext(),
  })

  const EXPECTED_DUCKULA = {
    ...FIXTURE,
    Event: FIXTURE.Event,
    State: FIXTURE.State,
    Type: FIXTURE.Type,
  }

  type Duckula  = typeof duckula.Event
  type Expected = typeof EXPECTED_DUCKULA.Event

  const typingTest: AssertEqual<Duckula, Expected> = true
  t.ok(typingTest, 'should match typing')

})
