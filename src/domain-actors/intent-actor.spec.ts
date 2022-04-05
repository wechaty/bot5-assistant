#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/* eslint-disable sort-keys */
import {
  AnyEventObject,
  createMachine,
  interpret,
}                           from 'xstate'
import { test, sinon }      from 'tstest'
import * as Mailbox         from 'mailbox'
import { createFixture }    from 'wechaty-mocker'

import { events, intents }  from '../schemas/mod.js'

import * as IntentActor   from '../application-actors/intent-actor.js'

test('IntentActor happy path smoke testing', async t => {
  for await (const fixtures of createFixture()) {
    const {
      mocker  : mockerFixtures,
      wechaty : wechatyFixtures,
    } = fixtures

    const sandbox = sinon.createSandbox({
      useFakeTimers: true,
    })

    const FIXTURES = [
      ['开始',    [intents.start]],
      ['停止',    [intents.stop]],
      ['都可能',  [intents.start, intents.stop, intents.unknown]],
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
            Mailbox.actions.proxy('TestMachine')(CHILD_ID),
          ],
        },
      },
    })

    const eventList: AnyEventObject[] = []
    const interpreter = interpret(parentMachine)
      .onEvent(e => eventList.push(e))
      .start()

    wechatyFixtures.bot.on('message', msg => {
      interpreter.send(
        events.MESSAGE(msg),
      )
    })

    for (const [text, expectedIntents] of FIXTURES) {
      eventList.length = 0
      mockerFixtures.player.say(text).to(mockerFixtures.bot)
      await sandbox.clock.runToLastAsync()

      // console.info(eventList)

      const actualChildReply = eventList.filter(e => e.type === Mailbox.Types.CHILD_REPLY)
      const expectedChildReply = [
        Mailbox.Events.CHILD_REPLY(
          events.INTENTS(expectedIntents),
        ),
      ]
      t.same(actualChildReply, expectedChildReply,
        `should get expected intents [${expectedIntents}] for text "${text}"`,
      )
    }

    sandbox.restore()
    interpreter.stop()
  }
})
