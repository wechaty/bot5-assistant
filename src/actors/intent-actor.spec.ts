#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/* eslint-disable sort-keys */

import {
  test,
  sinon,
}                   from 'tstest'

import {
  AnyEventObject,
  createMachine,
  interpret,
}                   from 'xstate'

import { createFixture } from 'wechaty-mocker'

import * as Mailbox from '../mailbox/mod.js'

import * as IntentActor  from './intent-actor.js'
import {
  Events,
  Intent,
}                   from '../schemas/mod.js'

test('intentMachine happy path smoke testing', async t => {
  for await (const fixtures of createFixture()) {
    const {
      mocker,
      wechaty,
    }           = fixtures

    const sandbox = sinon.createSandbox({
      useFakeTimers: true,
    })

    const FIXTURES = [
      ['开始',    [Intent.Start]],
      ['停止',    [Intent.Stop]],
      ['都可能',  [Intent.Start, Intent.Stop, Intent.Unknown]],
    ] as const

    const CHILD_ID = 'child'

    const parentMachine = createMachine({
      invoke: {
        id: CHILD_ID,
        src: IntentActor.machineFactory(),
      },
      on: {
        '*': {
          actions: [
            Mailbox.Actions.proxyToChild('TestMachine')(CHILD_ID),
          ],
        },
      },
    })

    const eventList: AnyEventObject[] = []
    const interpreter = interpret(parentMachine)
      .onEvent(e => eventList.push(e))
      .start()

    wechaty.bot.on('message', msg => {
      interpreter.send(
        Events.MESSAGE(msg),
      )
    })

    for (const [text, expectedIntents] of FIXTURES) {
      eventList.length = 0
      mocker.player.say(text).to(mocker.bot)
      await sandbox.clock.runToLastAsync()

      // console.info(eventList)

      const actualChildReply = eventList.filter(e => e.type === Mailbox.Types.CHILD_REPLY)
      const expectedChildReply = [
        Mailbox.Events.CHILD_REPLY(
          Events.INTENTS(expectedIntents),
        ),
      ]
      t.same(actualChildReply, expectedChildReply,
        `should get expected intents [${expectedIntents.map(i => Intent[i])}] for text "${text}"`,
      )
    }

    sandbox.restore()
    interpreter.stop()
  }
})
