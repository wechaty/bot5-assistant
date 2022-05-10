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
import { interpret, createMachine }     from 'xstate'
import { test }                         from 'tstest'
import * as Mailbox                     from 'mailbox'
import { isActionOf }                   from 'typesafe-actions'

import machine        from './machine.js'
import duckula        from './duckula.js'
import { FIXTURES }   from './fixtures.js'

test('TextToDate machine smoke testing', async t => {
  const [ [ TEXT, DATE_FACTORY ] ] = await FIXTURES()
  const DATE = DATE_FACTORY()

  const mailbox = Mailbox.from(
    machine.withContext({
      ...duckula.initialContext(),
    }),
  )
  mailbox.open()

  const TEST_ID = 'TestMachine'
  const testMachine = createMachine({
    id: TEST_ID,
    on: {
      '*': {
        actions: Mailbox.actions.proxy(TEST_ID)(mailbox),
      },
    },
  })

  const eventList: any[] = []
  const interpreter = interpret(testMachine)
    .onEvent(e => {
      console.info('Event:', e.type)
      eventList.push(e)
    })
    .start()

  const future = new Promise(resolve => {
    interpreter.onEvent(e =>
      isActionOf(
        [
          duckula.Event.DATE,
          duckula.Event.NO_DATE,
          duckula.Event.GERROR,
        ],
        e,
      ) && resolve(e))
  })

  interpreter.send(duckula.Event.TEXT(TEXT))
  await future
  // await new Promise(resolve => setTimeout(resolve, 10000))

  // eventList.forEach(e => console.info(e))
  t.same(
    eventList.at(-1),
    duckula.Event.DATE(+DATE),
    `should get expected DATE: ${DATE}`,
  )
  interpreter.stop()
})
