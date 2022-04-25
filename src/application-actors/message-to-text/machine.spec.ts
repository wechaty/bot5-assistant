#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/* eslint-disable sort-keys */
import {
  AnyEventObject,
  createMachine,
  interpret,
}                                       from 'xstate'
import { test }                         from 'tstest'
import * as Mailbox                     from 'mailbox'
import { filter, map, mergeMap }        from 'rxjs/operators'
import { isActionOf }                   from 'typesafe-actions'
import * as CQRS                        from 'wechaty-cqrs'
import path                             from 'path'
import { fileURLToPath }                from 'url'
import { FileBox, FileBoxInterface }    from 'file-box'

import * as WechatyActor    from '../../wechaty-actor/mod.js'
import { bot5Fixtures }     from '../../fixtures/bot5-fixture.js'

import machine    from './machine.js'
import duckula    from './duckula.js'

test('MessageToText actor smoke testing', async t => {
  for await (const fixtures of bot5Fixtures()) {
    const bus$ = CQRS.from(fixtures.wechaty.wechaty)
    const wechatyActor = WechatyActor.from(bus$, fixtures.wechaty.wechaty.puppet.id)

    const mailbox = Mailbox.from(machine.withContext({
      address: {
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

    const __dirname = path.dirname(fileURLToPath(import.meta.url))

    const SIL_FILE_BOX_FIXTURE_LOCAL = FileBox.fromFile(path.join(
      __dirname,
      '../../../tests/fixtures/sample.sil',
    )) as FileBoxInterface
    const SIL_FILE_BOX_FIXTURE_BASE64 = FileBox.fromBase64(await SIL_FILE_BOX_FIXTURE_LOCAL.toBase64(), SIL_FILE_BOX_FIXTURE_LOCAL.name)
    const SIL_EXPECTED_TEXT           = '大可乐两个统一，冰红茶三箱。'
    const DAT_FILE_BOX_FIXTURE_BASE64 = FileBox.fromBase64('aGVsbG8=', 'test.unknown')

    const FIXTURES = [
      [ 'hello world', 'hello world' ],
      [ SIL_FILE_BOX_FIXTURE_BASE64, SIL_EXPECTED_TEXT ],
      [ DAT_FILE_BOX_FIXTURE_BASE64, 'Message type "Unknown" is not supported by the messageToFileBox actor' ],
    ] as const

    for (const [ sayable, expectedText ] of FIXTURES) {

      eventList.length = 0

      const future = new Promise(resolve =>
        interpreter.onEvent(e =>
          isActionOf([
            duckula.Event.TEXT,
            duckula.Event.GERROR,
          ], e) && resolve(e),
        ),
      )

      fixtures.mocker.player.say(sayable).to(fixtures.mocker.bot)
      await future

      // eventList.forEach(e => console.info(e))
      t.same(
        eventList.filter(isActionOf([ duckula.Event.TEXT, duckula.Event.GERROR ])),
        [
          duckula.Event.TEXT(expectedText),
        ],
        `should get expected [FEEDBACK(${fixtures.mocker.player.id}, "${expectedText}")] for "${FileBox.valid(sayable) ? sayable.name : sayable}"`,
      )
    }

    interpreter.stop()
  }
})
