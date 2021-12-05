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
}                   from 'rxjs/operators'
import path from 'path'
import { fileURLToPath } from 'url'

import {
  mentionMachine,
  mentionModel,
} from './mention-machine.js'

const getFixtures = () => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))

  const CONTACT1 = {} as WECHATY.Contact
  const CONTACT2 = {} as WECHATY.Contact

  const EXPECTED_MENTION_LIST = [
    CONTACT1,
    CONTACT2,
  ]

  const MESSAGE = {
    mentionList: (): Promise<WECHATY.Contact[]> => Promise.resolve([]),
  } as WECHATY.Message

  const MESSAGE_MENTIONS = {
    mentionList: (): Promise<WECHATY.Contact[]> => Promise.resolve(EXPECTED_MENTION_LIST),
  } as WECHATY.Message

  return {
    EXPECTED_MENTION_LIST,
    MESSAGE,
    MESSAGE_MENTIONS,
  }
}

test('mention machine with mentions', async t => {
  const fixtures = getFixtures()

  const interpreter = interpret(mentionMachine)
    .start()

  // interpreter.subscribe(s => console.info('state:', s.value))

  const mentionEventFuture = firstValueFrom(from(interpreter).pipe(
    filter(state => state.event.type === 'MENTIONS'),
    map(state => state.event.mentions),
  ))

  // interpreter.subscribe(s => console.info('event:', s.event))

  interpreter.send(
    mentionModel.events.MESSAGE(fixtures.MESSAGE_MENTIONS),
  )

  let snapshot = interpreter.getSnapshot()
  t.equal(snapshot.value, 'extracting', 'should be extracting state')
  t.equal(snapshot.event.type, 'MESSAGE', 'should be MESSAGE event')
  t.same(snapshot.context.mentions, [], 'should be empty mention list')

  await mentionEventFuture
  snapshot = interpreter.getSnapshot()
  t.equal(snapshot.value, 'idle', 'should be idle after working')
  t.equal(snapshot.event.type, 'MENTIONS', 'should be MENTIONS event')
  t.equal(snapshot.event.mentions, fixtures.EXPECTED_MENTION_LIST, 'should has mention list event data')

  interpreter.stop()
})

test('mention machine without mention', async t => {
  const fixtures = getFixtures()

  const interpreter = interpret(mentionMachine)
    .start()

  // interpreter.subscribe(s => console.info('state:', s.value))
  // interpreter.subscribe(s => console.info('event:', s.event))

  const noMentionEventFuture = firstValueFrom(from(interpreter).pipe(
    filter(state => state.event.type === 'NO_MENTION'),
  ))

  interpreter.send(
    mentionModel.events.MESSAGE(fixtures.MESSAGE),
  )

  // console.info('NO_MENTION:', mentionModel.events.NO_MENTION())

  let snapshot = interpreter.getSnapshot()
  t.equal(snapshot.value, 'extracting', 'should be extracting state')
  t.equal(snapshot.event.type, 'MESSAGE', 'should be MESSAGE event')
  t.same(snapshot.context.mentions, [], 'should be empty mention list')

  await noMentionEventFuture
  snapshot = interpreter.getSnapshot()
  t.equal(snapshot.value, 'idle', 'should be idle after working')
  t.equal(snapshot.event.type, 'NO_MENTION', 'should be MENTIONS event')

  interpreter.stop()
})
