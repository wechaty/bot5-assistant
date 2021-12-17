#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/* eslint-disable sort-keys */

import {
  test,
}                   from 'tstest'

import * as events from './events.js'
import * as contexts from './contexts.js'

test('condCurrentEventFromMailbox() smoke testing', async t => {
  const context = contexts.initialContext()
  context.currentEvent = {
    ...events.DISPATCH(),
    meta: {
      origin: undefined,
    },
  }

  const result = events.condCurrentEventFromMailbox(context)
  t.ok(result, 'should recognize DISPATCH as mailbox event')
})
