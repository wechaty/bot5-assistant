#!/usr/bin/env -S node --no-warnings --loader ts-node/esm

import { test } from 'tstest'

import { speechToText } from './speech-to-text.js'
import * as audioFixtures from './audio-fixtures.js'

test('stt() smoke testing', async t => {
  const SILK = audioFixtures.silk
  const result = await speechToText(SILK.fileBox)
  t.equal(result, SILK.text, 'should recognize correct text: ' + SILK.text)
})
