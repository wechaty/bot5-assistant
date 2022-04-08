#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/* eslint-disable sort-keys */

import { test }   from 'tstest'

import { Intent } from '../schemas/mod.js'

import { textToIntents }  from './text-to-intents.js'

test('textToIntents()', async t => {
  const FIXTURES = [
    [ '开始', [ Intent.Start ] ],
    [ '停止', [ Intent.Stop ] ],
    [ '三个Intents的测试', [ Intent.Start, Intent.Stop, Intent.Unknown ] ],
  ] as const

  for (const [ text, intents ] of FIXTURES) {
    const result = await textToIntents(text)
    t.same(result, intents, `should get Intent.[${intents}] for ${text}`)
  }
})