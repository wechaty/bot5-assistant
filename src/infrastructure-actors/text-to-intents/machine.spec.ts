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
import {
  AnyEventObject,
  createMachine,
  EventObject,
  interpret,
}                                       from 'xstate'
import { test }                         from 'tstest'
import * as Mailbox                     from 'mailbox'
import { Observable, firstValueFrom }   from 'rxjs'
import { filter }                       from 'rxjs/operators'
import { isActionOf }                   from 'typesafe-actions'

import * as duck from '../../duck/mod.js'

import machine    from './machine.js'

test('IntentActor happy path smoke testing', async t => {
  const FIXTURES = [
    [ '开始',             [ duck.Intent.Start ] ],
    [ '停止',             [ duck.Intent.Stop ] ],
    [ '三个Intents的测试', [ duck.Intent.Start, duck.Intent.Stop, duck.Intent.Unknown ] ],
  ] as const

  const mailbox = Mailbox.from(machine)
  mailbox.open()

  const consumerMachine = createMachine({
    on: {
      '*': {
        actions: [
          Mailbox.actions.proxy('TestMachine')(mailbox),
        ],
      },
    },
  })

  const eventList: AnyEventObject[] = []
  const interpreter = interpret(consumerMachine)
    .onEvent(e => eventList.push(e))
    .start()

  for (const [ text, expectedIntents ] of FIXTURES) {

    const future = firstValueFrom<EventObject>(
      new Observable<EventObject>(
        subscribe => {
          interpreter.onEvent(e => subscribe.next(e))
        },
      ).pipe(
        filter(isActionOf(duck.Event.INTENTS)),
      ),
    )

    const TEXT = duck.Event.TEXT(text)

    eventList.length = 0
    interpreter.send(TEXT)

    // await new Promise(resolve => setTimeout(resolve, 10))
    // eventList.forEach(e => console.info(e))
    await future
    t.same(
      eventList,
      [
        TEXT,
        duck.Event.INTENTS(expectedIntents),
      ],
      `should get expected intents [${expectedIntents}] for text "${text}"`,
    )
  }

  interpreter.stop()
})
