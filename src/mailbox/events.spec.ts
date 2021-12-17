#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/* eslint-disable sort-keys */

import {
  test,
}                   from 'tstest'

import * as events from './events.js'
import * as contexts from './contexts.js'

test('condCurrentEventTypeIsMailbox() smoke testing', async t => {
  const context = contexts.initialContext()
  context.currentEvent = {
    ...events.DISPATCH(),
    [contexts.metaSymKey]: {
      origin: undefined,
    },
  }

  const result = events.condCurrentEventTypeIsMailbox(context)
  t.ok(result, 'should recognize DISPATCH as mailbox event')
})
