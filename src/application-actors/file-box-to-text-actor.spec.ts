#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/* eslint-disable sort-keys */
import { interpret, createMachine }     from 'xstate'
import { FileBox, FileBoxInterface }    from 'file-box'
import { test }                         from 'tstest'
import path                             from 'path'
import { fileURLToPath }                from 'url'
import * as Mailbox                     from 'mailbox'
import { isActionOf }                   from 'typesafe-actions'

import * as actor   from './file-box-to-text-actor.js'

test('machine initialState', async t => {
  t.equal(actor.machine.initialState.value, actor.State.Idle, 'should be initial state idle')
  t.equal(actor.machine.initialState.event.type, 'xstate.init', 'should be initial event from xstate')
  t.same(actor.machine.initialState.context, undefined, 'should be initial context')
})

test('process audio message', async t => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))

  const FILE_BOX_FIXTURE_LOCAL = FileBox.fromFile(path.join(
    __dirname,
    '../../tests/fixtures/sample.sil',
  )) as FileBoxInterface
  const FILE_BOX_FIXTURE_BASE64 = FileBox.fromBase64(await FILE_BOX_FIXTURE_LOCAL.toBase64(), FILE_BOX_FIXTURE_LOCAL.name)

  const FILE_BOX_FIXTURE_EVENT = actor.Event.FILE_BOX(
    JSON.stringify(FILE_BOX_FIXTURE_BASE64),
  )
  const EXPECTED_TEXT = '大可乐两个统一，冰红茶三箱。'

  const mailbox = Mailbox.from(
    actor.machine.withContext({
      ...actor.initialContext(),
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
          actor.Event.TEXT,
          actor.Event.GERROR,
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
    actor.Event.TEXT(EXPECTED_TEXT),
    `should get expected TEXT: ${EXPECTED_TEXT}`,
  )
  interpreter.stop()
})

test.only('process non-audio(image) message ', async t => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))

  const FILE_BOX_FIXTURE_LOCAL = FileBox.fromFile(path.join(
    __dirname,
    '../../docs/images/caq-bot5-qingyu.webp',
  )) as FileBoxInterface
  const FILE_BOX_FIXTURE_BASE64 = FileBox.fromBase64(await FILE_BOX_FIXTURE_LOCAL.toBase64(), FILE_BOX_FIXTURE_LOCAL.name)

  const FILE_BOX_FIXTURE_EVENT = actor.Event.FILE_BOX(
    JSON.stringify(FILE_BOX_FIXTURE_BASE64),
  )

  const mailbox = Mailbox.from(
    actor.machine.withContext({
      ...actor.initialContext(),
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
          actor.Event.TEXT,
          actor.Event.GERROR,
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
    actor.Type.GERROR,
    'should get GERROR for image',
  )
  interpreter.stop()
})
