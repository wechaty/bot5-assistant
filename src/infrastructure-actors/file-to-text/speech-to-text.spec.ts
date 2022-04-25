#!/usr/bin/env -S node --no-warnings --loader ts-node/esm

import { test } from 'tstest'

import { getSilkFixtures } from '../../../fixtures/get-silk-fixtures.js'

import { speechToText } from './speech-to-text.js'
import { FileBox } from 'file-box'

test('stt() smoke testing', async t => {
  const silkFixtures = await getSilkFixtures()
  const result = await speechToText(silkFixtures.fileBox)
  t.equal(result, silkFixtures.text, 'should recognize correct text: ' + silkFixtures.text)
})

test('stt() throws exception for unknown data', async t => {
  const fileBox = FileBox.fromBase64('aGVsbG8=', 'test.unknown')
  await t.rejects(() => speechToText(fileBox), 'should reject for unknown data')
})
