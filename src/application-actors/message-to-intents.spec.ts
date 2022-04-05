#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/* eslint-disable sort-keys */

import { test }   from 'tstest'

import { intents } from '../schemas/mod.js'

import { textToIntents }  from './message-to-intents.js'

test('textToIntents()', async t => {
  const FIXTURES = [
    ['开始', [intents.start]],
    ['停止', [intents.stop]],
    ['三个Intents的测试', [intents.start, intents.stop, intents.unknown]],
  ] as const

  for (const [text, intents] of FIXTURES) {
    const result = await textToIntents(text)
    t.same(result, intents, `should get Intent.[${intents}] for ${text}`)
  }
})
