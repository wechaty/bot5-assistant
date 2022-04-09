#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/* eslint-disable sort-keys */

import { test }   from 'tstest'

import * as duck from '../duck/mod.js'

import { textToIntents }  from './text-to-intents.js'

test('textToIntents()', async t => {
  const FIXTURES = [
    [ '开始', [ duck.Intent.Start ] ],
    [ '停止', [ duck.Intent.Stop ] ],
    [ '三个Intents的测试', [ duck.Intent.Start, duck.Intent.Stop, duck.Intent.Unknown ] ],
  ] as const

  for (const [ text, intents ] of FIXTURES) {
    const result = await textToIntents(text)
    t.same(result, intents, `should get duck.Intent.[${intents}] for ${text}`)
  }
})
