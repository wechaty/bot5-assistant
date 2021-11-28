#!/usr/bin/env -S node --no-warnings --loader ts-node/esm

import { test } from 'tstest'

import { FileBox } from 'file-box'

import path from 'path'
import { fileURLToPath } from 'url'

import { stt } from './stt.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

test('stt() smoke testing', async t => {
  const EXPECTED = '欢迎使用腾讯云的语音识别产品。'

  const fileBox = FileBox.fromFile(path.join(
    __dirname,
    '../tests/fixtures/speech-short.wav',
  ))

  const text = await stt(fileBox)

  t.equal(text, EXPECTED, 'should recognize correct')
})
