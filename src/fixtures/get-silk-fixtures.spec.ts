#!/usr/bin/env -S node --no-warnings --loader ts-node/esm

import { test } from 'tstest'

import { getSilkFixtures }   from './get-silk-fixtures.js'

test('silk fixture existance testing', async t => {
  const silkFixtures = await getSilkFixtures()
  await t.resolves(
    () => silkFixtures.fileBox.toBase64(),
    'should be able to read file to base64',
  )
})
