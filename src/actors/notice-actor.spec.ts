#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/* eslint-disable sort-keys */

import {
  test,
  sinon,
}                   from 'tstest'

import {
  AnyEventObject,
  interpret,
  createMachine,
  Interpreter,
  // spawn,
}                   from 'xstate'

import * as Mailbox from '../mailbox/mod.js'

import * as NoticeActor   from './notice-actor.js'
import * as WechatyActor  from './wechaty-actor.js'

import { bot5Fixtures } from './bot5-fixture.js'

test('noticeActor smoke testing', async t => {
  for await (const {
    mocker: mockerFixtures,
    wechaty: wechatyFixtures,
    moList,
  } of bot5Fixtures()) {
    const sandbox = sinon.createSandbox({
      useFakeTimers: { now: Date.now() }, // for make TencentCloud API timestamp happy
    })

    const wechatyMachine = WechatyActor.mailboxFactory(
      wechatyFixtures.wechaty,
      Mailbox.nil.logger,
    )
    const noticeMachine = NoticeActor.machineFactory(
      wechatyMachine.address,
    )

    const CHILD_ID = 'testing-child-id'
    const proxyMachine = createMachine({
      invoke: {
        id: CHILD_ID,
        src: noticeMachine,
      },
      on: {
        '*': {
          actions: [
            Mailbox.Actions.proxyToChild('ProxyMachine')(CHILD_ID),
          ],
        },
      },
    })

    const proxyEventList: AnyEventObject[] = []
    const proxyInterpreter = interpret(proxyMachine)
      .onEvent(e => proxyEventList.push(e))
      .start()

    const noticeRef = proxyInterpreter.children.get(CHILD_ID) as Interpreter<any>
    const noticeContext = () => noticeRef.getSnapshot().context as NoticeActor.Context

    const noticeEventList: AnyEventObject[] = []
    noticeRef.subscribe(s => noticeEventList.push(s.event))

    proxyInterpreter.send(NoticeActor.Events.NOTICE('test'))
    await sandbox.clock.runAllAsync()
    t.equal(moList.length, 0, 'should no message send out before set conversationId')

    proxyInterpreter.send(NoticeActor.Events.CONVERSATION(mockerFixtures.groupRoom.id))
    t.same(noticeContext(), {
      conversationId: mockerFixtures.groupRoom.id,
    }, 'should set conversation id after send event')

    const EXPECTED_TEXT = 'test'
    proxyInterpreter.send(NoticeActor.Events.NOTICE(EXPECTED_TEXT))
    await sandbox.clock.runAllAsync()
    t.equal(moList.length, 1, 'should sent message after set conversationId')
    t.equal(moList[0]!.room()!.id, mockerFixtures.groupRoom.id, 'should get room')
    t.ok(moList[0]!.text().endsWith(EXPECTED_TEXT), 'should say EXPECTED_TEXT out')

    proxyInterpreter.stop()
    sandbox.restore()
  }
})
