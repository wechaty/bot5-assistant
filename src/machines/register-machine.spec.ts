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
import type * as WECHATY from 'wechaty'
import {
  from,
  firstValueFrom,
  Subject,
}                   from 'rxjs'
import {
  filter,
  map,
}                   from 'rxjs/operators'
import path from 'path'
import { fileURLToPath } from 'url'

import {
  registerMachine,
  registerModel,
}                   from './register-machine.js'
import { createFixture } from 'wechaty-mocker'
import type { mock } from 'wechaty-puppet-mock'

test('register machine', async t => {
  const done$ = new Subject()
  const interpreter = interpret(registerMachine)
    .onDone(data => done$.next(data))
    .start()

  const doneFuture = firstValueFrom(done$)

  interpreter.subscribe(s => {
    console.info('state:', s.value)
    console.info('event:', s.event)
  })

  for await (const fixtures of createFixture()) {
    const {
      mocker,
      wechaty,
    }           = fixtures

    const [mary, mike] = mocker.mocker.createContacts(2) as [mock.ContactMock, mock.ContactMock]
    const meetingRoom = mocker.mocker.createRoom({
      memberIdList: [
        mary.id,
        mike.id,
        mocker.bot.id,
        mocker.player.id,
      ],
    })

    const messageFuture = new Promise<WECHATY.Message>(resolve => wechaty.bot.once('message', resolve))
    mary.say().to(meetingRoom)
    const message = await messageFuture

    console.info(message)

    interpreter.send(
      registerModel.events.MESSAGE(message),
    )

    let snapshot = interpreter.getSnapshot()
    t.equal(snapshot.value, 'extracting', 'should be extracting state')
    t.equal(snapshot.event.type, 'MESSAGE', 'should be MESSAGE event')
    t.same(snapshot.context.members, [], 'should be empty mention list')

    await doneFuture
    snapshot = interpreter.getSnapshot()
    t.equal(snapshot.value, 'idle', 'should be idle after working')
    t.equal(snapshot.event.type, 'MENTIONS', 'should be MENTIONS event')

    interpreter.stop()
  }
})
