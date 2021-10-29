#!/usr/bin/env -S node --no-warnings --loader ts-node/esm

import { test } from 'tstest'

import {
  validatePlugin,
}                   from 'wechaty-plugin-contrib'

import {
  Bot5Assistant,
}                     from './plugin.js'

test('VoteOut()', async t => {
  t.doesNotThrow(() => validatePlugin(Bot5Assistant), 'should pass the validation')
})
