#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
import { test } from 'tstest'

import { invokeId } from './invoke-id.js'

test('invokeId() smoke testing', async t => {
  const FIXTURES = [
    [
      [ 'childId', 'parentId', 'id1', 'id2' ],
      'childId@parentId@id1@id2',
    ],
  ] as const

  for (const [ ids, expected ] of FIXTURES) {
    t.equal(invokeId(ids[0], ids[1], ...ids.slice(2)), expected, `invokeId(${ids}) should be ${expected}`)
  }
})
