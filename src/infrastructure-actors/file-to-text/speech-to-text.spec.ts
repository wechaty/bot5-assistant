#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/**
 *   Wechaty Open Source Software - https://github.com/wechaty
 *
 *   @copyright 2022 Huan LI (李卓桓) <https://github.com/huan>, and
 *                   Wechaty Contributors <https://github.com/wechaty>.
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 *
 */

import { test } from 'tstest'

import { getSilkFixtures } from '../../fixtures/get-silk-fixtures.js'

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
