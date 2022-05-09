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
  interpret,
  createMachine,
  AnyInterpreter,
}                                   from 'xstate'
import { firstValueFrom, from }     from 'rxjs'
import { map, mergeMap, filter, tap, share }    from 'rxjs/operators'
import { test }                     from 'tstest'
import type * as WECHATY            from 'wechaty'
import type { mock }                from 'wechaty-puppet-mock'
import * as Mailbox                 from 'mailbox'
import * as CQRS                    from 'wechaty-cqrs'

import * as WechatyActor    from 'wechaty-actor'
import { MessageToText }    from '../../application-actors/mod.js'
import { TextToIntents }    from '../../infrastructure-actors/mod.js'

import duckula    from './duckula.js'
import machine    from './machine.js'
import { bot5Fixtures } from '../../fixtures/bot5-fixture.js'
import { isActionOf } from 'typesafe-actions'

test('intent actor smoke testing', async t => {
  let interpreter: AnyInterpreter

  for await (const {
    mocker: mockerFixtures,
    wechaty: wechatyFixtures,
  } of bot5Fixtures()) {
    const bus$ = CQRS.from(wechatyFixtures.wechaty)
    const wechatyMailbox = WechatyActor.from(bus$, wechatyFixtures.wechaty.puppet.id)
    wechatyMailbox.open()

    const messageToTextMailbox = Mailbox.from(MessageToText.machine.withContext({
      ...MessageToText.initialContext(),
      actors: {
        wechaty: String(wechatyMailbox.address),
      },
    }))
    messageToTextMailbox.open()

    const textToIntentsMailbox = Mailbox.from(TextToIntents.machine.withContext(TextToIntents.initialContext()))
    textToIntentsMailbox.open()

    const intentMailbox = Mailbox.from(machine.withContext({
      ...duckula.initialContext(),
      actors: {
        messageToText: String(messageToTextMailbox.address),
        textToIntents: String(textToIntentsMailbox.address),
      },
    }))
    intentMailbox.open()

    const testMachine = createMachine({
      on: {
        '*': {
          actions: Mailbox.actions.proxy('TestMachine')(intentMailbox),
        },
      },
    })

    const eventList: AnyEventObject[] = []
    interpreter = interpret(testMachine)
      .onEvent(e => eventList.push(e))
      .start()

    /**
     * Huan(202204): Workaround: make it HOT
     *
     * Bug: `interpreter.subscribe()` acts like a BehaviorObservable
     *  @link https://github.com/statelyai/xstate/issues/3259
     */
    const state$ = from(interpreter).pipe(
      share(),
    )
    // make it keep hot
    state$.subscribe(() => {})

    bus$.pipe(
      // tap(e => console.info('### bus$', e)),
      filter(CQRS.is(CQRS.events.MessageReceivedEvent)),
      map(e => CQRS.queries.GetMessagePayloadQuery(wechatyFixtures.wechaty.puppet.id, e.payload.messageId)),
      mergeMap(CQRS.execute$(bus$)),
      map(response => response.payload.message),
      filter(Boolean),
      map(messagePayload => duckula.Event.MESSAGE(messagePayload)),
    ).subscribe(e => {
      // console.info('### duckula.Event.MESSAGE', e)
      interpreter.send(e)
    })

    for (const [ text, intents ] of TextToIntents.FIXTURES) {
      eventList.length = 0
      const future = firstValueFrom(state$.pipe(
        map(state => state.event),
        filter(isActionOf(duckula.Event.INTENTS)),
        // tap(e => console.info('### duckula.Event.INTENTS', e)),
      ))
      mockerFixtures.mary.say(text).to(mockerFixtures.groupRoom)
      await future

      // eventList
      //   .forEach(e => console.info(e))
      // console.info('^^^^^vvvvvv')
      // eventList
      //   .filter(isActionOf(duckula.Event.INTENTS))
      //   .forEach(e => console.info(e))

      t.same(eventList.filter(isActionOf(duckula.Event.INTENTS)), [
        duckula.Event.INTENTS(
          intents,
          eventList
            .filter(isActionOf(duckula.Event.MESSAGE))
            .at(-1)!
            .payload
            .message,
        ),
      ], `should get Intents [${intents}] for ${text}`)
    }
  }

  interpreter!.stop()
})
