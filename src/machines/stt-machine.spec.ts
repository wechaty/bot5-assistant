#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/* eslint-disable sort-keys */

import {
  test,
  // sinon,
}                   from 'tstest'

import {
  forwardTo,
  interpret,
  createMachine,
  actions,
  // spawn,
}                   from 'xstate'
import * as WECHATY from 'wechaty'
import {
  from,
  firstValueFrom,
}                   from 'rxjs'
import {
  filter,
  map,
  tap,
}                   from 'rxjs/operators'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  FileBox,
  FileBoxInterface,
}                         from 'file-box'

import {
  Events,
  Types,
}                 from '../schemas/mod.js'
import {
  sttActor,
  sttMachine,
}                     from './stt-machine.js'

const getFixtures = () => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))

  const EXPECTED_TEXT = '大可乐两个，统一冰红茶三箱。'
  const FILE_BOX = FileBox.fromFile(path.join(
    __dirname,
    '../../tests/fixtures/sample.sil',
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

  return {
    EXPECTED_TEXT,
    AUDIO_MESSAGE,
    TEXT_MESSAGE,
    IMAGE_MESSAGE,
  }
}

const parentMachineTest = createMachine({
  id: 'parent',
  initial: 'working',
  context: {
    // stt: {} as any,
    text: undefined as undefined | string,
  },
  // entry: [
  //   actions.assign({
  //     stt: () => spawn(sttMachine, 'stt'),
  //   }),
  // ],
  invoke: {
    id: 'stt',
    onDone: 'done',
    src: sttActor,
  },
  states: {
    done: {
      type: 'final',
    },
    working: {
      on: {
        [Types.MESSAGE]: {
          actions: forwardTo('stt'),
        },
        [Types.TEXT]: {
          actions: 'saveText',
        },
        [Types.STOP]: {
          target: 'done',
        },
      },
    },
  },
}, {
  actions: {
    saveText: actions.assign({ text: (_, event) => (event as ReturnType<typeof Events.TEXT>).payload.text }),
  },
})

test('stt machine initialState', async t => {
  const INITIAL_STATE = {
    message: null,
  }
  t.equal(sttMachine.initialState.value, 'idle', 'should be initial state idle')
  t.equal(sttMachine.initialState.event.type, 'xstate.init', 'should be initial event from xstate')
  t.same(sttMachine.initialState.context, INITIAL_STATE, 'should be initial context')
})

test('stt machine process audio message', async t => {
  const fixtures = getFixtures()

  let machineDoneCallback = () => {}
  const machineDoneFuture = new Promise<void>(resolve => {
    machineDoneCallback = resolve
  })
  const interpreter = interpret(parentMachineTest)
    .onDone(machineDoneCallback)
    .start()

  // interpreter.subscribe(s => console.info('state:', s.value))

  const textEventFuture = firstValueFrom(from(interpreter).pipe(
    tap(s => console.info('Transition to', s.value)),
    tap(s => console.info('Received event', s.event.type)),
    filter(state => state.event.type === Types.TEXT),
    map(state => (state.event as ReturnType<typeof Events.TEXT>).payload.text),
  ))

  // interpreter.subscribe(s => console.info('event:', s.event))

  interpreter.send(
    Events.MESSAGE(fixtures.AUDIO_MESSAGE),
  )

  let snapshot = interpreter.getSnapshot()
  t.equal(snapshot.value, 'working', 'should be working state')
  t.equal(snapshot.event.type, Types.MESSAGE, 'should be MESSAGE event')
  t.equal(snapshot.context.text, undefined, 'should be initial context')

  await textEventFuture
  snapshot = interpreter.getSnapshot()
  t.equal(snapshot.value, 'working', 'should be working')
  t.equal(snapshot.event.type, Types.TEXT, 'should be TEXT event')
  t.equal((snapshot.event as ReturnType<typeof Events.TEXT>).payload.text, fixtures.EXPECTED_TEXT, 'should has stt-ed TEXT event data')
  t.equal(snapshot.context.text, fixtures.EXPECTED_TEXT, 'should set stt-ed text to context')

  interpreter.send(Types.STOP)

  await machineDoneFuture
  snapshot = interpreter.getSnapshot()
  t.equal(snapshot.value, 'done', 'should be done')
  t.equal(snapshot.event.type, Types.STOP, 'should be STOP event')

  interpreter.stop()
})

test('stt machine process non-audio message (text)', async t => {
  const fixtures = getFixtures()

  const interpreter = interpret(parentMachineTest).start()

  // interpreter.subscribe(s => console.info('event:', s.event))

  interpreter.send(
    Events.MESSAGE(fixtures.TEXT_MESSAGE),
  )

  let snapshot = interpreter.getSnapshot()
  t.equal(snapshot.value, 'working', 'should be working state')
  t.equal(snapshot.event.type, Types.NO_AUDIO, 'should be NO_AUDIO event')

  interpreter.send(
    Events.MESSAGE(fixtures.IMAGE_MESSAGE),
  )

  snapshot = interpreter.getSnapshot()
  t.equal(snapshot.value, 'working', 'should be working state')
  t.equal(snapshot.event.type, Types.NO_AUDIO, 'should be NO_AUDIO event')

  interpreter.stop()
})
