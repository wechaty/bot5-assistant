#!/usr/bin/env -S node --no-warnings --loader ts-node/esm

import {
  test,
}                   from 'tstest'

import {
  interpret,
}                   from 'xstate'

import * as BatchEvents  from './batched-events-machine.fixture.js'

test('BatchEvents.machine process concurency DING events', async t => {
  const interpreter = interpret(BatchEvents.machine)

  interpreter.onTransition(s => {
    console.info('onTransition: ')
    console.info('  - states:', s.value)
    console.info('  - event:', s.event.type)
    console.info()
  })

  const ARRAY_LIST = [...Array(3).keys()]
  const DING_EVENT_LSIT = ARRAY_LIST
    .map(i => BatchEvents.Events.DING(i))

  interpreter.start()
  interpreter.send(DING_EVENT_LSIT)

  const snapshot = interpreter.getSnapshot()
  t.same(snapshot.context.queue, ARRAY_LIST, 'should store all events payloads in context.queue')

  interpreter.stop()
})
