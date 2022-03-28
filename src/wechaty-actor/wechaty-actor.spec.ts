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
  // spawn,
}                           from 'xstate'
import { firstValueFrom }   from 'rxjs'
import { filter }           from 'rxjs/operators'
import { test, sinon }      from 'tstest'
import type * as WECHATY    from 'wechaty'
import * as CQRS            from 'wechaty-cqrs'
import * as PUPPET          from 'wechaty-puppet'
import { createFixture }    from 'wechaty-mocker'

import * as Mailbox from '../mailbox/mod.js'

import { machineFactory } from './wechaty-actor.js'

test('wechatyMachine Mailbox actor validation', async t => {
  const wechatyMachine = machineFactory({} as any, '')
  t.doesNotThrow(() => Mailbox.validate(wechatyMachine), 'should pass validate')
})

test('wechatyActor SAY with concurrency', async t => {
  for await (const {
    wechaty: {
      wechaty,
      room,
    },
  } of createFixture()) {
    const bus$ = CQRS.from(wechaty)

    const wechatyMachine = machineFactory(bus$, wechaty.puppet.id)

    const WECHATY_MACHINE_ID = 'wechaty-machine-id'

    const testActor = createMachine({
      invoke: {
        src: Mailbox.wrap(wechatyMachine),
        id: WECHATY_MACHINE_ID,
      },
      on: {
        '*': {
          actions: Mailbox.Actions.proxyToChild('TestActor')(WECHATY_MACHINE_ID),
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

    interpreter.send(CQRS.commands.SendMessageCommand(wechaty.puppet.id, room.id, PUPPET.payloads.sayable.text(EXPECTED_TEXT + 0)))
    interpreter.send(CQRS.commands.SendMessageCommand(wechaty.puppet.id, room.id, PUPPET.payloads.sayable.text(EXPECTED_TEXT + 1)))
    interpreter.send(CQRS.commands.SendMessageCommand(wechaty.puppet.id, room.id, PUPPET.payloads.sayable.text(EXPECTED_TEXT + 2)))
    // eventList.forEach(e => console.info(e.type))

    /**
     * Wait async: `wechaty.puppet.messageSendText()`
     */
    await new Promise(setImmediate)
    t.equal(spy.callCount, 3, 'should emit 3 messages')
    t.equal(spy.args[1]![0].type(), wechaty.Message.Type.Text, 'should emit text message')
    t.equal(spy.args[1]![0].text(), EXPECTED_TEXT + 1, `should emit "${EXPECTED_TEXT}1"`)

    interpreter.stop()
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

    const wechatyMachine = machineFactory(bus$, wechaty.puppet.id)

    const testMachine = createMachine({
      invoke: {
        src: wechatyMachine,
        id: WECHATY_MACHINE_ID,
      },
      on: {
        '*': {
          actions: Mailbox.Actions.proxyToChild('TestMachine')(WECHATY_MACHINE_ID),
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
      CQRS.commands.SendMessageCommand(wechaty.puppet.id, room.id, PUPPET.payloads.sayable.text(EXPECTED_TEXT, [player.id])),
    )
    const message = await future
    t.equal(message.text(), EXPECTED_TEXT, `should get said message "${EXPECTED_TEXT}"`)

    interpreter.stop()
  }

})

test.only('wechatyMachine message send / recv', async t => {
  const WECHATY_MACHINE_ID = 'wechaty-machine-id'

  for await (const {
    wechaty: {
      wechaty,
      bot,
    },
  } of createFixture()) {

    const bus$ = CQRS.from(wechaty)

    const wechatyMachine = machineFactory(bus$, wechaty.puppet.id)

    const testMachine = createMachine({
      invoke: {
        src: wechatyMachine,
        id: WECHATY_MACHINE_ID,
      },
      on: {
        '*': {
          actions: Mailbox.Actions.proxyToChild('TestMachine')(WECHATY_MACHINE_ID),
        },
      },
    })

    const eventList: AnyEventObject[] = []
    const interpreter = interpret(testMachine)
      .onTransition(s => eventList.push(s.event))
      .start()

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
    t.equal(response.payload.isLoggedIn, true, 'should get response for logged in state')

    /**
     * isLoggedIn
     */
    const future2 = firstValueFrom(bus$.pipe(
      filter(CQRS.is(CQRS.responses.GetCurrentUserIdQueryResponse)),
    ))
    interpreter.send(
      CQRS.queries.GetCurrentUserIdQuery(wechaty.puppet.id),
    )
    const response2 = await future2
    t.equal(response2.payload.contactId, bot.id, 'should get response for bot id')

    interpreter.stop()
  }

})