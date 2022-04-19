#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
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

import * as duck   from '../duck/mod.js'

import IntentActor    from './intent-actor.js'
import { isActionOf } from 'typesafe-actions'

test('IntentActor happy path smoke testing', async t => {
  const FIXTURES = [
    [ '开始',             [ duck.Intent.Start ] ],
    [ '停止',             [ duck.Intent.Stop ] ],
    [ '三个Intents的测试', [ duck.Intent.Start, duck.Intent.Stop, duck.Intent.Unknown ] ],
  ] as const

  const mailbox = Mailbox.from(IntentActor.machine)
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
