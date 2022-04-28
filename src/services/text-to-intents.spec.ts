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
