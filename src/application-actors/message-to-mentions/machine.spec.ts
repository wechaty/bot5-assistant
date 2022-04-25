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

import * as WechatyActor    from '../../wechaty-actor/mod.js'
import { bot5Fixtures }     from '../../fixtures/bot5-fixture.js'

import machine    from './machine.js'
import duckula    from './duckula.js'

test('MessageToMentions actor smoke testing', async t => {
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

    const FIXTURES = [
      [ undefined, [] ],
      [ [], [] ],
      [
        [
          fixtures.mocker.mary,
          fixtures.mocker.mike,
        ],
        [
          fixtures.wechaty.mary.payload,
          fixtures.wechaty.mike.payload,
        ],
      ],
    ] as const

    for (const [ mentionList, expectedList ] of FIXTURES) {

      eventList.length = 0

      const future = new Promise(resolve =>
        interpreter.onEvent(e =>
          isActionOf(duckula.Event.CONTACTS, e) && resolve(e),
        ),
      )

      fixtures.mocker.player.say('test', mentionList as any).to(fixtures.mocker.groupRoom)
      await future

      // eventList.forEach(e => console.info(e))
      t.same(
        eventList
          .filter(isActionOf(duckula.Event.CONTACTS)),
        [
          duckula.Event.CONTACTS(expectedList as any),
        ],
        `should get expected [CONTACTS] for "${mentionList}"`,
      )
    }

    interpreter.stop()
  }
})
