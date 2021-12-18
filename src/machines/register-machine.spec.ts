#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/* eslint-disable sort-keys */

import {
  test,
  // sinon,
}                   from 'tstest'

import {
  interpret,
  // spawn,
}                   from 'xstate'
import type * as WECHATY from 'wechaty'
import {
  firstValueFrom,
  Subject,
}                   from 'rxjs'

import { createFixture } from 'wechaty-mocker'
import type { mock } from 'wechaty-puppet-mock'

import {
  Events,
  Types,
}                 from '../schemas/mod.js'

import {
  registerMachine,
  registerActor,
}                   from './register-machine.js'

test('register machine', async t => {
  const done$ = new Subject()
  const interpreter = interpret(registerMachine)
    .onDone(data => done$.next(data))
    .start()

  const doneFuture = firstValueFrom(done$)

  interpreter.subscribe(s => {
    console.info('Transition to', s.value)
    console.info('Receiving event', s.event.type)
  })

  let snapshot = interpreter.getSnapshot()
  t.equal(snapshot.value, 'registering', 'should be registering state')
  t.same(snapshot.context.members, [], 'should be empty mention list')

  for await (const fixtures of createFixture()) {
    const {
      mocker,
      wechaty,
    }           = fixtures

    const [mary, mike] = mocker.mocker.createContacts(2) as [mock.ContactMock, mock.ContactMock]

    const MEMBER_ID_LIST = [
      mary.id,
      mike.id,
      mocker.bot.id,
      mocker.player.id,
    ]

    const meetingRoom = mocker.mocker.createRoom({
      memberIdList: MEMBER_ID_LIST,
    })

    const messageFutureNoMention = new Promise<WECHATY.Message>(resolve => wechaty.wechaty.once('message', resolve))

    mary.say('register').to(meetingRoom)

    interpreter.send(
      Events.MESSAGE(
        await messageFutureNoMention,
      ),
    )

    snapshot = interpreter.getSnapshot()
    t.equal(snapshot.value, 'mentioning', 'should be mentioning state')
    t.equal(snapshot.event.type, Types.MESSAGE, 'should be MESSAGE event')
    t.same(snapshot.context.members, [], 'should have empty mentioned id list before onDone')

    await new Promise(setImmediate)

    snapshot = interpreter.getSnapshot()
    t.equal(snapshot.value, 'registering', 'should be back to registering state')
    t.equal(snapshot.event.type, 'error.platform.getMentions', 'should be error.platform.getMentions event')
    t.same(snapshot.context.members, [], 'should have empty mentioned id list before onDone')

    const messageFutureMentions = new Promise<WECHATY.Message>(resolve => wechaty.wechaty.once('message', resolve))

    const MENTION_LIST = [mike, mary, mocker.player]
    mary.say('register', MENTION_LIST).to(meetingRoom)

    interpreter.send(
      Events.MESSAGE(
        await messageFutureMentions,
      ),
    )

    snapshot = interpreter.getSnapshot()
    t.equal(snapshot.value, 'mentioning', 'should be mentioning state')
    t.equal(snapshot.event.type, Types.MESSAGE, 'should be MESSAGE event')
    t.same(snapshot.context.members, [], 'should have empty mentioned id list before onDone')

    await doneFuture
    snapshot = interpreter.getSnapshot()
    t.equal(snapshot.value, 'finish', 'should be finish after done')
    t.equal(snapshot.event.type, 'done.invoke.getMentions', 'should be done.invoke.getMentions event')
    t.same((snapshot.event as any).data.map((c: any) => c.id), MENTION_LIST.map(c => c.id), 'should get mention list')
  }

  interpreter.stop()
})
