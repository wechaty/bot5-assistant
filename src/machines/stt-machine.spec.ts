#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/* eslint-disable sort-keys */

import {
  test,
  sinon,
}                   from 'tstest'

import {
  forwardTo,
  interpret,
  createMachine,
  actions,
}                   from 'xstate'
import * as WECHATY from 'wechaty'
import {
  from,
  firstValueFrom,
}                   from 'rxjs'
import {
  filter,
  map,
}                   from 'rxjs/operators'
import path from 'path'
import { fileURLToPath } from 'url'

import {
  // sttModel,
  sttMachine,
}                     from './stt-machine.js'
import { FileBox, FileBoxInterface } from 'file-box'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const EXPECTED_TEXT = '大可乐两个，统一冰红茶三箱。'
const FILE_BOX = FileBox.fromFile(path.join(
  __dirname,
  '../../tests/fixtures/sample.silk',
)) as FileBoxInterface

const MESSAGE_BASE = {
  wechaty: {
    Message: {
      Type: WECHATY.types.Message,
    },
  },
}

const TEXT_MESSAGE = {
  ...MESSAGE_BASE,
  text: () => EXPECTED_TEXT,
  type: () => WECHATY.impls.MessageImpl.Type.Text,
} as WECHATY.Message

const AUDIO_MESSAGE = {
  ...MESSAGE_BASE,
  toFileBox: () => Promise.resolve(FILE_BOX),
  type: () => WECHATY.impls.MessageImpl.Type.Audio,
} as WECHATY.Message

const IMAGE_MESSAGE = {
  ...AUDIO_MESSAGE, // just dump data from audio message
  type: () => WECHATY.impls.MessageImpl.Type.Image,
} as WECHATY.Message

const parentMachine = createMachine({
  id: 'parent',
  initial: 'working',
  context: {
    text: undefined as undefined | string,
  },
  invoke: {
    id: 'stt',
    onDone: 'done',
    src: sttMachine,
  },
  states: {
    done: {
      type: 'final',
    },
    working: {
      on: {
        MESSAGE: {
          actions: forwardTo('stt'),
        },
        TEXT: {
          actions: 'saveText',
        },
        STOP: {
          target: 'done',
        },
      },
    },
  },
}, {
  actions: {
    saveText: actions.assign({
      text: (_, event) => event.data.text,
    }),
  },
})

test('stt machine initialState', async t => {
  t.equal(sttMachine.initialState.value, 'idle', 'should be initial state idle')
  t.same(sttMachine.initialState.context, { message: undefined, text: undefined }, 'should be initial context')
  t.same(sttMachine.initialState.event, { type: 'xstate.init' }, 'should be initial event from xstate')
})

test('stt machine process audio message', async t => {

  let machineDoneCallback = () => {}
  const machineDoneFuture = new Promise<void>(resolve => {
    machineDoneCallback = resolve
  })
  const interpreter = interpret(parentMachine)
    .onDone(machineDoneCallback)
    .start()

  // interpreter.subscribe(s => console.info('state:', s.value))

  const textEventFuture = firstValueFrom(from(interpreter).pipe(
    filter(state => state.event.type === 'TEXT'),
    map(state => state.event.data.text),
  ))

  interpreter.send({
    data: {
      message: AUDIO_MESSAGE,
    },
    type: 'MESSAGE',
  } as any)

  let snappshot = interpreter.getSnapshot()
  t.equal(snappshot.value, 'working', 'should be working state')
  t.equal(snappshot.event.type, 'MESSAGE', 'should be MESSAGE event')
  t.same(snappshot.context, { text: undefined }, 'should be initial context')

  await textEventFuture
  snappshot = interpreter.getSnapshot()
  t.equal(snappshot.value, 'working', 'should be working')
  t.equal(snappshot.event.type, 'TEXT', 'should be TEXT event')
  t.same(snappshot.event.data, { text: EXPECTED_TEXT }, 'should has stt-ed TEXT event data')
  t.same(snappshot.context, { text: EXPECTED_TEXT }, 'should set stt-ed text to context')

  interpreter.send('STOP')

  await machineDoneFuture
  snappshot = interpreter.getSnapshot()
  t.equal(snappshot.value, 'done', 'should be done')
  t.equal(snappshot.event.type, 'STOP', 'should be STOP event')

  interpreter.stop()
})

test.only('stt machine process text message', async t => {

  const interpreter = interpret(parentMachine).start()

  interpreter.subscribe(s => console.info('state:', s.value))

  const textEventFuture = firstValueFrom(from(interpreter).pipe(
    filter(state => state.event.type === 'TEXT'),
    map(state => state.event.data.text),
  ))

  interpreter.send({
    data: {
      message: TEXT_MESSAGE,
    },
    type: 'MESSAGE',
  } as any)

  // let snappshot = interpreter.getSnapshot()
  // t.equal(snappshot.value, 'working', 'should be working state')
  // t.equal(snappshot.event.type, 'TEXT', 'should be MESSAGE event')
  // t.same(snappshot.context, { text: undefined }, 'should be initial context')

  await textEventFuture

  const snappshot = interpreter.getSnapshot()
  // t.equal(snappshot.value, 'working', 'should be working')
  t.equal(snappshot.event.type, 'TEXT', 'should be TEXT event')
  t.same(snappshot.event.data, { text: EXPECTED_TEXT }, 'should has stt-ed TEXT event data')
  // t.same(snappshot.context, { text: EXPECTED_TEXT }, 'should set stt-ed text to context')

  interpreter.stop()
})

// interpreter.send({
//   message: IMAGE_MESSAGE,
//   type: 'MESSAGE',
// })

// t.notOk(interpreter.state.can(events.START), 'should can not START again in meeting')
