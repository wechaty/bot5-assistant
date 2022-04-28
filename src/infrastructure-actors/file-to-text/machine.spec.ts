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
import { interpret, createMachine, actions }    from 'xstate'
import { FileBox, FileBoxInterface }            from 'file-box'
import { test }                                 from 'tstest'
import path                                     from 'path'
import { fileURLToPath }                        from 'url'
import * as Mailbox                             from 'mailbox'
import { isActionOf }                           from 'typesafe-actions'

import machine    from './machine.js'
import duckula    from './duckula.js'

test('machine initialState', async t => {
  t.equal(machine.initialState.value, duckula.State.Idle, 'should be initial state idle')
  t.equal(machine.initialState.event.type, 'xstate.init', 'should be initial event from xstate')
  t.same(machine.initialState.context, duckula.initialContext(), 'should be initial context')
})

test('process audio message', async t => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))

  const FILE_BOX_FIXTURE_LOCAL = FileBox.fromFile(path.join(
    __dirname,
    '../../../tests/fixtures/sample.sil',
  )) as FileBoxInterface
  const FILE_BOX_FIXTURE_BASE64 = FileBox.fromBase64(await FILE_BOX_FIXTURE_LOCAL.toBase64(), FILE_BOX_FIXTURE_LOCAL.name)

  const FILE_BOX_FIXTURE_EVENT = duckula.Event.FILE_BOX(
    FILE_BOX_FIXTURE_BASE64,
  )
  const EXPECTED_TEXT = '大可乐两个统一，冰红茶三箱。'

  const mailbox = Mailbox.from(
    machine.withContext({
      ...duckula.initialContext(),
    }),
  )
  mailbox.open()

  const consumerMachineTest = createMachine({
    id: 'consumer',
    initial: 'idle',
    states: {
      idle: {
        on: {
          '*': {
            actions: Mailbox.actions.proxy('ConsumerMachineTest')(mailbox),
            target: 'idle',
          },
        },
      },
    },
  })

  const eventList: any[] = []
  const interpreter = interpret(consumerMachineTest)
    .onEvent(e => {
      // console.info('Event:', e.type)
      eventList.push(e)
    })
    .start()

  const future = new Promise(resolve => {
    interpreter.onEvent(e =>
      isActionOf(
        [
          duckula.Event.TEXT,
          duckula.Event.GERROR,
        ],
        e,
      ) && resolve(e))
  })

  interpreter.send(FILE_BOX_FIXTURE_EVENT)
  await future
  // await new Promise(resolve => setTimeout(resolve, 10000))

  // eventList.forEach(e => console.info(e))
  t.same(
    eventList.at(-1),
    duckula.Event.TEXT(EXPECTED_TEXT),
    `should get expected TEXT: ${EXPECTED_TEXT}`,
  )
  interpreter.stop()
})

test('process non-audio(image) message ', async t => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))

  const FILE_BOX_FIXTURE_LOCAL = FileBox.fromFile(path.join(
    __dirname,
    '../../../docs/images/caq-bot5-qingyu.webp',
  )) as FileBoxInterface
  const FILE_BOX_FIXTURE_BASE64 = FileBox.fromBase64(await FILE_BOX_FIXTURE_LOCAL.toBase64(), FILE_BOX_FIXTURE_LOCAL.name)

  const FILE_BOX_FIXTURE_EVENT = duckula.Event.FILE_BOX(
    FILE_BOX_FIXTURE_BASE64,
  )

  const mailbox = Mailbox.from(
    machine.withContext({
      ...duckula.initialContext(),
    }),
  )
  mailbox.open()

  const consumerMachineTest = createMachine({
    id: 'consumer',
    initial: 'idle',
    states: {
      idle: {
        on: {
          '*': {
            actions: Mailbox.actions.proxy('ConsumerMachineTest')(mailbox),
            target: 'idle',
          },
        },
      },
    },
  })

  const eventList: any[] = []
  const interpreter = interpret(consumerMachineTest)
    .onEvent(e => {
      // console.info('Event:', e.type)
      eventList.push(e)
    })
    .start()

  const future = new Promise(resolve => {
    interpreter.onEvent(e =>
      isActionOf(
        [
          duckula.Event.TEXT,
          duckula.Event.GERROR,
        ],
        e,
      ) && resolve(e))
  })

  interpreter.send(FILE_BOX_FIXTURE_EVENT)
  await future
  // await new Promise(resolve => setTimeout(resolve, 10000))

  // eventList.forEach(e => console.info(e))
  t.same(
    eventList.at(-1).type,
    duckula.Type.GERROR,
    'should get GERROR for image',
  )
  interpreter.stop()
})

test('state invoke smoke testing', async t => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))

  const FILE_BOX_FIXTURE_LOCAL = FileBox.fromFile(path.join(
    __dirname,
    '../../../tests/fixtures/sample.sil',
  )) as FileBoxInterface
  const FILE_BOX_FIXTURE_BASE64 = FileBox.fromBase64(await FILE_BOX_FIXTURE_LOCAL.toBase64(), FILE_BOX_FIXTURE_LOCAL.name)

  const FILE_BOX_FIXTURE_EVENT = duckula.Event.FILE_BOX(
    FILE_BOX_FIXTURE_BASE64,
  )
  const EXPECTED_TEXT = '大可乐两个统一，冰红茶三箱。'

  const parentMachineTest = createMachine({
    id: 'parent',
    initial: 'idle',
    states: {
      idle: {
        on: {
          '*': 'busy',
        },
      },
      busy: {
        invoke: {
          id: duckula.id,
          src: machine,
        },
        entry: [
          actions.send((_, e) => e, { to: duckula.id }),
        ],
        on: {
          [Mailbox.Type.ACTOR_REPLY]: {
            actions: [
              actions.log((_, e) => 'received ACTOR_REPLY ' + JSON.stringify(e)),
              actions.send((_, e) => (e as Mailbox.Event['ACTOR_REPLY']).payload.message),
            ],
          },
          [duckula.Type.TEXT]: {
            actions: [
              actions.log('received TEXT'),
            ],
          },
          [duckula.Type.GERROR]: {
            actions: [
              actions.log('received GERROR'),
            ],
          },
        },
      },
    },
  })

  const eventList: any[] = []
  const interpreter = interpret(parentMachineTest)
    .onEvent(e => {
      console.info('Event:', e.type)
      eventList.push(e)
    })
    .start()

  const future = new Promise(resolve => {
    interpreter.onEvent(e =>
      isActionOf(
        [
          duckula.Event.TEXT,
          duckula.Event.GERROR,
        ],
        e,
      ) && resolve(e))
  })

  interpreter.send(FILE_BOX_FIXTURE_EVENT)
  await future
  // await new Promise(resolve => setTimeout(resolve, 10000))

  // eventList.forEach(e => console.info(e))
  t.same(
    eventList.at(-1),
    duckula.Event.TEXT(EXPECTED_TEXT),
    `should get expected TEXT: ${EXPECTED_TEXT}`,
  )
  interpreter.stop()
})
