#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/* eslint-disable sort-keys */

import {
  AnyEventObject,
  interpret,
  createMachine,
  Interpreter,
}                       from 'xstate'
import { test, sinon }  from 'tstest'
import * as CQRS        from 'wechaty-cqrs'
import * as Mailbox     from 'mailbox'

import * as WechatyActor    from '../../wechaty-actor/mod.js'
import { bot5Fixtures }   from '../../fixtures/bot5-fixture.js'

import machine    from './machine.js'
import duckula    from './duckula.js'

test('noticeActor smoke testing', async t => {
  for await (const {
    mocker: mockerFixtures,
    wechaty: wechatyFixtures,
    moList,
  } of bot5Fixtures()) {
    const sandbox = sinon.createSandbox({
      useFakeTimers: { now: Date.now() }, // for make TencentCloud API timestamp happy
    })

    const bus$ = CQRS.from(wechatyFixtures.wechaty)

    const wechatyMailbox = Mailbox.from(
      WechatyActor.machine.withContext({
        ...WechatyActor.initialContext(),
        bus$,
        puppetId: wechatyFixtures.wechaty.puppet.id,
      }),
    )
    wechatyMailbox.open()

    const noticeMachine = machine.withContext({
      ...duckula.initialContext(),
      address: {
        wechaty: String(wechatyMailbox.address),
      },
    })

    const CHILD_ID = 'testing-child-id'
    const proxyMachine = createMachine({
      invoke: {
        id: CHILD_ID,
        src: noticeMachine,
      },
      on: {
        '*': {
          actions: [
            Mailbox.actions.proxy('ProxyMachine')(CHILD_ID),
          ],
        },
      },
    })

    const proxyEventList: AnyEventObject[] = []
    const proxyInterpreter = interpret(proxyMachine)
      .onEvent(e => proxyEventList.push(e))
      .start()

    const noticeRef = proxyInterpreter.children.get(CHILD_ID) as Interpreter<any>
    const noticeContext = () => noticeRef.getSnapshot().context as ReturnType<typeof duckula.initialContext>

    const noticeEventList: AnyEventObject[] = []
    noticeRef.subscribe(s => noticeEventList.push(s.event))

    proxyInterpreter.send(duckula.Event.NOTICE('test'))
    await sandbox.clock.runAllAsync()
    t.equal(moList.length, 0, 'should no message send out before set conversationId')

    proxyInterpreter.send(duckula.Event.CONVERSATION(mockerFixtures.groupRoom.id))
    await sandbox.clock.runAllAsync()
    t.same(noticeContext(), {
      conversationId: mockerFixtures.groupRoom.id,
      address: {
        wechaty: String(wechatyMailbox.address),
      },
    }, 'should set conversation id after send event')

    const EXPECTED_TEXT = 'test'
    proxyInterpreter.send(duckula.Event.NOTICE(EXPECTED_TEXT))
    await sandbox.clock.runAllAsync()
    t.equal(moList.length, 1, 'should sent message after set conversationId')
    t.equal(moList[0]!.room()!.id, mockerFixtures.groupRoom.id, 'should get room')
    t.ok(moList[0]!.text().endsWith(EXPECTED_TEXT), 'should say EXPECTED_TEXT out')

    // moList.length = 0
    // proxyInterpreter.send(
    //   CQRS.commands.SendMessageCommand(
    //     CQRS.uuid.NIL,
    //     mockerFixtures.groupRoom.id,
    //     CQRS.sayables.text(EXPECTED_TEXT),
    //   ),
    // )
    // await sandbox.clock.runAllAsync()
    // t.equal(moList.length, 1, 'should compatible with WechatyAction events by forwarding them')
    // t.equal(moList[0]!.room()!.id, mockerFixtures.groupRoom.id, 'should get room with wechaty actor event')
    // t.ok(moList[0]!.text().endsWith(EXPECTED_TEXT), 'should say EXPECTED_TEXT out with wechaty actor event')

    proxyInterpreter.stop()
    sandbox.restore()
  }
})
