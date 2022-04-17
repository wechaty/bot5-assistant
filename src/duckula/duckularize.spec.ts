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

test('duckularize() array param values', async t => {

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

test('duckularize() array param typings', async t => {

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

test('duckularize() object param values', async t => {

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

test('duckularize() object param typings', async t => {

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

  type DuckulaEvent   = typeof duckula.Event
  type DuckulaState   = typeof duckula.State
  type DuckulaType    = typeof duckula.Type
  type DuckulaContext = ReturnType<typeof duckula.initialContext>

  type ExpectedEvent   = typeof EXPECTED_DUCKULA.Event
  type ExpectedState   = typeof EXPECTED_DUCKULA.State
  type ExpectedType    = typeof EXPECTED_DUCKULA.Type
  type ExpectedContext = ReturnType<typeof EXPECTED_DUCKULA.initialContext>

  const typingTestEvent:    AssertEqual<DuckulaEvent,   ExpectedEvent>   = true
  const typingTestState:    AssertEqual<DuckulaState,   ExpectedState>   = true
  const typingTestType:     AssertEqual<DuckulaType,    ExpectedType>    = true
  const typingTestContext:  AssertEqual<DuckulaContext, ExpectedContext> = true

  t.ok(typingTestEvent,   'should match typing for Event')
  t.ok(typingTestState,   'should match typing for State')
  t.ok(typingTestType,    'should match typing for Type')
  t.ok(typingTestContext, 'should match typing for Context')
})
