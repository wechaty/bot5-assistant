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
  createMachine,
  interpret,
  AnyEventObject,
}                           from 'xstate'
import { firstValueFrom }   from 'rxjs'
import { filter }           from 'rxjs/operators'
import { test, sinon }      from 'tstest'
import type * as WECHATY    from 'wechaty'
import * as CQRS            from 'wechaty-cqrs'
import * as PUPPET          from 'wechaty-puppet'
import { createFixture }    from 'wechaty-mocker'
import * as Mailbox         from 'mailbox'
import { isActionOf }       from 'typesafe-actions'

import * as duck    from './duck/mod.js'

import machine    from './machine.js'

test('wechatyMachine Mailbox actor validation', async t => {
  const wechatyMachine = machine.withContext({} as any)
  t.doesNotThrow(() => Mailbox.helpers.validate(wechatyMachine), 'should pass validate')
})

test('wechatyActor SAY with concurrency', async t => {
  const sandbox = sinon.createSandbox({
    useFakeTimers: true,
  })

  for await (const {
    wechaty: {
      wechaty,
      room,
    },
  } of createFixture()) {
    const bus$ = CQRS.from(wechaty)

    const wechatyMachine = machine.withContext({
      bus$,
      puppetId: wechaty.puppet.id,
    })

    const WECHATY_MACHINE_ID = 'wechaty-machine-id'

    const testActor = createMachine({
      invoke: {
        src: Mailbox.helpers.wrap(wechatyMachine),
        id: WECHATY_MACHINE_ID,
      },
      on: {
        '*': {
          actions: Mailbox.actions.proxy('TestActor')(WECHATY_MACHINE_ID),
        },
      },
    })

    const EXPECTED_TEXT = 'hello world'

    const eventList: AnyEventObject[] = []
    const interpreter = interpret(testActor)
      .onTransition(s => eventList.push(s.event))
      .start()

    eventList.length = 0

    const spy = sinon.spy()
    wechaty.on('message', spy)

    for (const i of [ ...Array(3).keys() ]) {
      interpreter.send(
        CQRS.commands.SendMessageCommand(
          wechaty.puppet.id,
          room.id,
          PUPPET.payloads.sayable.text(EXPECTED_TEXT + i),
        ),
      )
    }
    // eventList.forEach(e => console.info(e.type))

    /**
     * Wait async: `wechaty.puppet.messageSendText()`
     */
    await sandbox.clock.runToLastAsync()
    t.equal(spy.callCount, 3, 'should emit 3 messages')
    t.equal(spy.args[1]![0].type(), wechaty.Message.Type.Text, 'should emit text message')
    t.equal(spy.args[1]![0].text(), EXPECTED_TEXT + 1, `should emit "${EXPECTED_TEXT}1"`)

    interpreter.stop()
    sandbox.restore()
  }
})

test('wechatyMachine interpreter smoke testing', async t => {
  const WECHATY_MACHINE_ID = 'wechaty-machine-id'

  for await (const {
    wechaty: {
      wechaty,
      player,
      room,
    },
  } of createFixture()) {

    const bus$ = CQRS.from(wechaty)

    const wechatyMachine = machine.withContext({
      bus$,
      puppetId: wechaty.puppet.id,
    })

    const testMachine = createMachine({
      invoke: {
        src: wechatyMachine,
        id: WECHATY_MACHINE_ID,
      },
      on: {
        '*': {
          actions: Mailbox.actions.proxy('TestMachine')(WECHATY_MACHINE_ID),
        },
      },
    })

    const eventList: AnyEventObject[] = []
    const interpreter = interpret(testMachine)
      .onTransition(s => eventList.push(s.event))
      .start()

    const EXPECTED_TEXT = 'hello world'
    const future = new Promise<WECHATY.Message>(resolve =>
      wechaty.once('message', resolve),
    )
    interpreter.send(
      CQRS.commands.SendMessageCommand(wechaty.puppet.id, room.id, PUPPET.payloads.sayable.text(EXPECTED_TEXT, [ player.id ])),
    )
    const message = await future
    t.equal(message.text(), EXPECTED_TEXT, `should get said message "${EXPECTED_TEXT}"`)

    interpreter.stop()
  }

})

test('wechatyMachine isLoggedIn & currentUserId & authQrCode', async t => {
  const WECHATY_MACHINE_ID = 'wechaty-machine-id'

  for await (const {
    wechaty: {
      wechaty,
      bot,
    },
  } of createFixture()) {

    const bus$ = CQRS.from(wechaty)

    const wechatyMachine = machine.withContext({
      bus$,
      puppetId: wechaty.puppet.id,
    })

    const testMachine = createMachine({
      invoke: {
        src : wechatyMachine,
        id  : WECHATY_MACHINE_ID,
      },
      on: {
        '*': {
          actions: Mailbox.actions.proxy('TestMachine')(WECHATY_MACHINE_ID),
        },
      },
    })

    const eventList: AnyEventObject[] = []
    const interpreter = interpret(testMachine)
      .onTransition(s => eventList.push(s.event))
      .start()

    // We need to wait the bullet to fly a while because here we are testing the machine (instead of Mailbox actor)
    await new Promise(setImmediate)

    /**
     * isLoggedIn
     */
    const future = firstValueFrom(bus$.pipe(
      filter(CQRS.is(CQRS.responses.GetIsLoggedInQueryResponse)),
    ))
    interpreter.send(
      CQRS.queries.GetIsLoggedInQuery(wechaty.puppet.id),
    )
    const response = await future
    t.equal(response.payload.isLoggedIn, true, 'should get isLoggedIn response from bot')

    // We need to wait the bullet to fly a while because here we are testing the machine (instead of Mailbox actor)
    await new Promise(setImmediate)

    /**
     * currentUserId
     */
    const future2 = firstValueFrom(bus$.pipe(
      filter(CQRS.is(CQRS.responses.GetCurrentUserIdQueryResponse)),
    ))
    interpreter.send(
      CQRS.queries.GetCurrentUserIdQuery(wechaty.puppet.id),
    )
    const response2 = await future2
    t.equal(response2.payload.contactId, bot.id, 'should get currentUesrId response from bot')

    // We need to wait the bullet to fly a while because here we are testing the machine (instead of Mailbox actor)
    await new Promise(setImmediate)

    /**
     * authQrCode
     */
    const future3 = firstValueFrom(bus$.pipe(
      filter(CQRS.is(CQRS.responses.GetAuthQrCodeQueryResponse)),
    ))
    interpreter.send(
      CQRS.queries.GetAuthQrCodeQuery(wechaty.puppet.id),
    )
    const response3 = await future3
    t.equal(response3.payload.qrcode, undefined, 'should get auth qrcode response from bot')

    interpreter.stop()
  }

})

test('wechatyMachine EXECUTE & RESPONSE events', async t => {
  for await (const {
    wechaty: {
      wechaty,
    },
  } of createFixture()) {

    const bus$ = CQRS.from(wechaty)
    const puppetId = wechaty.puppet.id

    const wechatyMailbox = Mailbox.from(
      machine.withContext({
        bus$,
        puppetId: wechaty.puppet.id,
      }),
    )

    wechatyMailbox.open()

    const testMachine = createMachine({
      id: 'testMachine',
      on: {
        '*': {
          actions: wechatyMailbox.address.send((_, e) => e),
        },
      },
    })

    const eventList: AnyEventObject[] = []
    const interpreter = interpret(testMachine)
      .onEvent(e => eventList.push(e))
      .start()

    const future = new Promise<InstanceType<typeof CQRS.responses.GetIsLoggedInQueryResponse>>(
      resolve => interpreter.onEvent(
        e => {
          // console.info('onEvent', e)
          if (isActionOf(CQRS.responses.GetIsLoggedInQueryResponse, e)) {
            resolve(e)
          }
        },
      ),
    )

    const query = CQRS.queries.GetIsLoggedInQuery(puppetId)

    interpreter.send(query)

    const EXPECTED = CQRS.responses.GetIsLoggedInQueryResponse({
      ...query.meta,
      isLoggedIn: true,
    })

    // await new Promise(resolve => setTimeout(resolve, 100))
    // console.info(eventList)

    const response = await future

    // console.info('###', response)

    t.same(
      JSON.parse(JSON.stringify(response)),
      JSON.parse(JSON.stringify(EXPECTED)),
      'should get CQRS.responses.GetIsLoggedInQueryResponse response from CQRS.queries.GetIsLoggedInQuery',
    )

    interpreter.stop()
  }

})

test('wechatyMachine BATCH_EXECUTE & BATCH_RESPONSE events', async t => {
  for await (const {
    wechaty: {
      wechaty,
      bot,
    },
  } of createFixture()) {

    const bus$ = CQRS.from(wechaty)
    const puppetId = wechaty.puppet.id

    const wechatyMailbox = Mailbox.from(
      machine.withContext({
        bus$,
        puppetId: wechaty.puppet.id,
      }),
    )

    wechatyMailbox.open()

    const testMachine = createMachine({
      id: 'testMachine',
      on: {
        '*': {
          actions: wechatyMailbox.address.send((_, e) => e),
        },
      },
    })

    const eventList: AnyEventObject[] = []
    const interpreter = interpret(testMachine)
      .onEvent(e => eventList.push(e))
      .start()

    const future = new Promise<duck.Event['BATCH_RESPONSE']>(
      resolve => interpreter.onEvent(
        e => {
          // console.info('onEvent', e)
          if (isActionOf(duck.Event.BATCH_RESPONSE, e)) {
            resolve(e)
          }
        },
      ),
    )

    interpreter.send(
      duck.Event.BATCH_EXECUTE([
        CQRS.queries.GetIsLoggedInQuery(puppetId),
        CQRS.queries.GetCurrentUserIdQuery(puppetId),
        CQRS.queries.GetAuthQrCodeQuery(puppetId),
      ]),
    )

    const res = {
      id: CQRS.uuid.NIL,
      puppetId,
    }

    const EXPECTED = duck.Event.BATCH_RESPONSE([
      CQRS.responses.GetIsLoggedInQueryResponse({     ...res, isLoggedIn: true }),
      CQRS.responses.GetCurrentUserIdQueryResponse({  ...res, contactId: bot.id }),
      CQRS.responses.GetAuthQrCodeQueryResponse({     ...res, qrcode: undefined }),
    ])

    // await new Promise(resolve => setTimeout(resolve, 100))
    // eventList.forEach(e => console.info(e))

    const response = await future
    response.payload.responseList.forEach(r => { 'id' in r.meta && (r.meta.id = CQRS.uuid.NIL) })

    t.same(
      JSON.parse(JSON.stringify(response)),
      JSON.parse(JSON.stringify(EXPECTED)),
      'should get batch response',
    )

    interpreter.stop()
  }

})

test('TODO: add a GERROR test', async t => {
  await t.skip('TBW')
})
