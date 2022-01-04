#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/* eslint-disable sort-keys */

import {
  test,
  sinon,
}                   from 'tstest'

import {
  createMachine,
  interpret,
  AnyEventObject,
  // spawn,
}                   from 'xstate'
import type * as WECHATY from 'wechaty'
import { createFixture } from 'wechaty-mocker'
import {
  Events,
  States,
  Types,
}           from '../schemas/mod.js'

import {
  machineFactory,
}                   from './wechaty-actor.js'
import * as Mailbox from '../mailbox/mod.js'

test('wechatyActor SAY with concurrency', async t => {
  for await (const WECHATY_FIXTURES of createFixture()) {
    const {
      wechaty,
      bot,
      player,
      room,
    }         = WECHATY_FIXTURES.wechaty

    const wechatyMachine = machineFactory(wechaty)
    const WECHATY_MACHINE_ID = 'wechaty-machine-id'

    const testActor = createMachine({
      invoke: {
        src: Mailbox.wrap(wechatyMachine),
        id: WECHATY_MACHINE_ID,
      },
      on: { '*': {
        actions: Mailbox.Actions.proxyToChild(WECHATY_MACHINE_ID),
      }},
    })

    const EXPECTED_TEXT = 'hello world'

    const eventList: AnyEventObject[] = []
    const interpreter = interpret(testActor)
      .onTransition(s => eventList.push(s.event))
      .start()

    interpreter.send(Events.WECHATY(wechaty))

    eventList.length = 0

    const spy = sinon.spy()
    wechaty.on('message', spy)

    interpreter.send(Events.SAY(EXPECTED_TEXT + 0, room.id, []))
    interpreter.send(Events.SAY(EXPECTED_TEXT + 1, room.id, []))
    interpreter.send(Events.SAY(EXPECTED_TEXT + 2, room.id, []))
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

  for await (const WECHATY_FIXTURES of createFixture()) {
    const {
      wechaty,
      bot,
      player,
      room,
    }         = WECHATY_FIXTURES.wechaty

    const wechatyMachine = machineFactory(wechaty)

    const testMachine = createMachine({
      invoke: {
        src: wechatyMachine,
        id: WECHATY_MACHINE_ID,
      },
      on: {
        '*': {
          actions: Mailbox.Actions.proxyToChild(WECHATY_MACHINE_ID),
        },
      },
    })

    const eventList: AnyEventObject[] = []
    const interpreter = interpret(testMachine)
      .onTransition(s => eventList.push(s.event))
      .start()
    let snapshot = interpreter.getSnapshot()

    interpreter.send([
      Events.WECHATY(wechaty),
    ])
    interpreter.send(
      Events.START(),
    )
    const EXPECTED_TEXT = 'hello world'
    const future = new Promise<WECHATY.Message>(resolve =>
      wechaty.once('message', resolve),
    )
    interpreter.send(
      Events.SAY(EXPECTED_TEXT, room.id, [player.id]),
    )
    const message = await future
    t.equal(message.text(), EXPECTED_TEXT, `should get said message "${EXPECTED_TEXT}"`)

    interpreter.stop()
  }

})
