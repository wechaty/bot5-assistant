#!/usr/bin/env -S node --no-warnings --loader ts-node/esm

import { test } from 'tstest'

import {
  validatePlugin,
}                   from 'wechaty-plugin-contrib'

import {
  VoteOut,
}                     from './bot5.js'

test('VoteOut()', async t => {
  t.doesNotThrow(() => validatePlugin(VoteOut), 'should pass the validation')
})
