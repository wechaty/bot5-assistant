#!/usr/bin/env -S node --no-warnings --loader ts-node/esm

import { test } from 'tstest'

import { FileBox } from 'file-box'

import path from 'path'
import { fileURLToPath } from 'url'

import { stt } from './stt.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

test('stt() smoke testing', async t => {
  const EXPECTED = '大可乐两个，统一冰红茶三箱。'

  const fileBox = FileBox.fromFile(path.join(
    __dirname,
    '../tests/fixtures/sample.silk',
  ))

  const text = await stt(fileBox)

  t.equal(text, EXPECTED, 'should recognize correct')
})
