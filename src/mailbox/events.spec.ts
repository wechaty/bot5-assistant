#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/* eslint-disable sort-keys */

import {
  test,
}                   from 'tstest'

import {
  Events,
  condCurrentEventTypeIsMailbox,
}                                   from './events.js'
import * as contexts from './contexts.js'

test('condCurrentEventTypeIsMailbox() smoke testing', async t => {
  const context = contexts.initialContext()
  context.currentEvent = {
    ...Events.DISPATCH(),
    [contexts.metaSymKey]: {
      origin: undefined,
    },
  }

  const result = condCurrentEventTypeIsMailbox(context)
  t.ok(result, 'should recognize DISPATCH as mailbox event')
})
