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
import { FileBox }                      from 'file-box'

import * as WechatyActor    from '../../wechaty-actor/mod.js'
import { bot5Fixtures }     from '../../domain-actors/bot5-fixture.js'

import machine    from './machine.js'
import duckula    from './duckula.js'

test('MessageToFile actor smoke testing', async t => {
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

    const FILE_BOX_FIXTURE = FileBox.fromBase64(
      await FileBox.fromBuffer(
        Buffer.from('test', 'utf-8'),
      ).toBase64(),
      'test.jpg',
    )

    const FIXTURES = [
      [ 'hello world', FileBox.fromBase64('TWVzc2FnZSB0eXBlICJUZXh0IiBpcyBub3Qgc3VwcG9ydGVkIGJ5IHRoZSBtZXNzYWdlVG9GaWxlQm94IGFjdG9y', 'gerror.txt') ],
      [ FILE_BOX_FIXTURE, FILE_BOX_FIXTURE ],
    ] as const

    for (const [ sayable, expectedFileBox ] of FIXTURES) {

      eventList.length = 0

      const future = new Promise(resolve =>
        interpreter.onEvent(e =>
          isActionOf(duckula.Event.FILE_BOX, e) && resolve(e),
        ),
      )

      fixtures.mocker.player.say(sayable).to(fixtures.mocker.bot)
      await future

      // eventList.forEach(e => console.info(e))
      t.same(
        eventList
          .filter(isActionOf(duckula.Event.FILE_BOX))
          .map(e => JSON.stringify(e)),
        [
          JSON.stringify(duckula.Event.FILE_BOX(expectedFileBox)),
        ],
        `should get expected [FILE_BOX("${expectedFileBox.name}")] for "${FileBox.valid(sayable) ? sayable.name : sayable}"`,
      )
    }

    interpreter.stop()
  }
})
