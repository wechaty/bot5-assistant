#!/usr/bin/env -S node --no-warnings --loader ts-node/esm

import { test } from 'tstest'

import * as audioFixtures from './audio-fixtures.js'

test('silk fixture existance testing', async t => {
  await t.resolves(
    () => audioFixtures.silk.fileBox.toBase64(),
    'should be able to read file to base64',
  )
})
