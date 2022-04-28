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

test('nextContact()', async t => {
  for await (const {
    wechaty: wechatyFixtures,
  } of bot5Fixtures()) {
    const context = duckula.initialContext()
    t.equal(selectors.nextContact(context), undefined, 'should return undefined when context is empty')

    context.contacts = [
      wechatyFixtures.mary.payload!,
      wechatyFixtures.mike.payload!,
      wechatyFixtures.player.payload!,
      wechatyFixtures.bot.payload!,
    ].reduce((acc, cur) => ({ ...acc, [cur.id]: cur }), {})

    t.equal(selectors.nextContact(context), wechatyFixtures.mary.payload!, 'should return first contact in the list when context.feedbacks is empty')

    context.feedbacks = {
      [wechatyFixtures.mary.id]: 'im mary',
    }
    t.equal(selectors.nextContact(context), wechatyFixtures.mike.payload!, 'should return second contact in the list when context.feedbacks is set to mary feedback')

    context.feedbacks = {
      [wechatyFixtures.mary.id]: 'im mary',
      [wechatyFixtures.mike.id]: 'im mike',
    }
    t.equal(selectors.nextContact(context), wechatyFixtures.player.payload!, 'should return third contact in the list when context.feedbacks is set to mary&mike feedbacks')

    context.feedbacks = {
      [wechatyFixtures.mary.id]: 'im mary',
      [wechatyFixtures.mike.id]: 'im mike',
      [wechatyFixtures.player.id]: 'im player',
      [wechatyFixtures.bot.id]: 'im bot',
    }
    t.equal(selectors.nextContact(context), undefined, 'should return undefined if everyone has feedbacked')

  }
})
