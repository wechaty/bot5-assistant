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
  interpret,
}                                     from 'xstate'
import { test }                       from 'tstest'
import * as Mailbox                   from 'mailbox'
import { filter, map, mergeMap }      from 'rxjs/operators'
import { isActionOf }                 from 'typesafe-actions'
import * as CQRS                      from 'wechaty-cqrs'
import { FileBox }                    from 'file-box'

import * as duck    from '../../duck/mod.js'

import * as WechatyActor    from 'wechaty-actor'
import { bot5Fixtures }     from '../../fixtures/bot5-fixture.js'
import { FileToText, TextToIntents }    from '../../infrastructure-actors/mod.js'

import machine    from './machine.js'
import duckula    from './duckula.js'

test('MessageToIntents actor smoke testing', async t => {
  for await (const fixtures of bot5Fixtures()) {
    const bus$ = CQRS.from(fixtures.wechaty.wechaty)
    const wechatyActor = WechatyActor.from(bus$, fixtures.wechaty.wechaty.puppet.id)

    const mailbox = Mailbox.from(machine.withContext({
      actors: {
        wechaty: String(wechatyActor.address),
      },
    }))
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

    bus$.pipe(
      // tap(e => console.info('### bus$', e)),
      filter(CQRS.is(CQRS.events.MessageReceivedEvent)),
      map(e => CQRS.queries.GetMessagePayloadQuery(fixtures.wechaty.wechaty.puppet.id, e.payload.messageId)),
      mergeMap(CQRS.execute$(bus$)),
      map(response => response.payload.message),
      filter(Boolean),
      map(messagePayload => duckula.Event.MESSAGE(messagePayload)),
    ).subscribe(e => {
      // console.info('### duckula.Event.MESSAGE', e)
      interpreter.send(e)
    })

    const fileFixtures = await FileToText.FIXTURES()

    const FIXTURES = [
      ...TextToIntents.FIXTURES(),
      [ fileFixtures[0][0], [ duck.Intent.CocaCola ] ],
    ] as const

    for (const [ sayable, intents ] of FIXTURES) {

      eventList.length = 0

      const future = new Promise(resolve =>
        interpreter.onEvent(e =>
          isActionOf([
            duckula.Event.INTENTS,
            duckula.Event.GERROR,
          ], e) && resolve(e),
        ),
      )

      fixtures.mocker.player.say(sayable).to(fixtures.mocker.bot)
      await future

      // eventList.forEach(e => console.info(e))
      t.same(
        eventList.filter(isActionOf([ duckula.Event.INTENTS, duckula.Event.GERROR ])),
        [
          duckula.Event.INTENTS(
            intents,
            eventList
              .filter(isActionOf(duckula.Event.MESSAGE))
              .at(-1)!
              .payload
              .message
            ,
          ),
        ],
        `should get expected "${intents}" for "${FileBox.valid(sayable) ? sayable.name : sayable}"`,
      )
    }

    interpreter.stop()
  }
})
