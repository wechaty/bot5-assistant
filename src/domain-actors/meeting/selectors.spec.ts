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

import { test }           from 'tstest'

import { bot5Fixtures }   from '../../fixtures/bot5-fixture.js'

import duckula            from './duckula.js'
import * as selectors     from './selectors.js'

test('chair() & viceChairs', async t => {
  for await (const {
    wechaty: wechatyFixtures,
  } of bot5Fixtures()) {
    const context = duckula.initialContext()
    t.equal(selectors.chair(context), undefined, 'should return undefined when context is empty')

    context.chairs = [
      wechatyFixtures.player.payload!,
      wechatyFixtures.mary.payload!,
      wechatyFixtures.mike.payload!,
    ]

    t.same(selectors.chair(context), wechatyFixtures.player.payload!, 'should return first contact in the list for chair')
    t.same(selectors.viceChairs(context), [
      wechatyFixtures.mary.payload!,
      wechatyFixtures.mike.payload!,
    ], 'should return the second and following contacts in the list for vice chairs')
  }
})
