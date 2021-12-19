#!/usr/bin/env -S node --no-warnings --loader ts-node/esm

import { test } from 'tstest'

import { stt } from './stt.js'
import * as audioFixtures from './audio-fixtures.js'

test('stt() smoke testing', async t => {
  const SILK = audioFixtures.silk
  const result = await stt(SILK.fileBox)
  t.equal(result, SILK.text, 'should recognize correct text: ' + SILK.text)
})
