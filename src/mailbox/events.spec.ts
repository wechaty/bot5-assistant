#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/* eslint-disable sort-keys */

import {
  test,
}                   from 'tstest'

import {
  Events,
}                                   from './events.js'

test('tbw', async t => {
  void Events
  t.pass('tbw')
})
