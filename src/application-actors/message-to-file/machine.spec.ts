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
import { bot5Fixtures }     from '../../fixtures/bot5-fixture.js'

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

    ;(mailbox as Mailbox.impls.Mailbox).internal.actor.interpreter?.subscribe(s => {
      console.info(s.value)
      console.info('>>> transition:', [
        `(${s.history?.value || ''})`.padEnd(30, ' '),
        ' + ',
        `[${s.event.type}]`.padEnd(30, ' '),
        ' = ',
        `(${s.value})`.padEnd(30, ' '),
      ].join(''))
    })

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
      [ 'hello world', duckula.Event.GERROR('Message type "Text" is not supported by the messageToFileBox actor') ],
      [ FILE_BOX_FIXTURE, duckula.Event.FILE_BOX(FILE_BOX_FIXTURE) ],
    ] as const

    for (const [ sayable, expected ] of FIXTURES) {

      eventList.length = 0

      const future = new Promise(resolve =>
        interpreter.onEvent(e =>
          isActionOf([
            duckula.Event.FILE_BOX,
            duckula.Event.GERROR,
          ], e) && resolve(e),
        ),
      )

      fixtures.mocker.player.say(sayable).to(fixtures.mocker.bot)
      await future

      // eventList.forEach(e => console.info(e))
      t.same(
        eventList
          .filter(isActionOf([ duckula.Event.FILE_BOX, duckula.Event.GERROR ]))
          .map(e => JSON.parse(JSON.stringify(e))),
        [
          JSON.parse(JSON.stringify(expected)),
        ],
        `should get expected "${expected}" for "${FileBox.valid(sayable) ? sayable.name : sayable}"`,
      )
    }

    interpreter.stop()
  }
})
