#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/**
 *   Wechaty Open Source Software - https://github.com/wechaty
 *
 *   @copyright 2022 Huan LI (李卓桓) <https://github.com/huan>, and
 *                   Wechaty Contributors <https://github.com/wechaty>.
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 *
 */
/* eslint-disable sort-keys */
import {
  AnyEventObject,
  createMachine,
  interpret,
  actions,
}                       from 'xstate'
import { test }         from 'tstest'
import * as Mailbox     from 'mailbox'

import * as duck    from '../duck/mod.js'

import { responseStates } from './response-states.js'
import { isActionOf } from 'typesafe-actions'

test('statesResponse() smoke testing', async t => {
  const childId = 'child-id'
  const childMachine = createMachine({
    id: childId,
    initial: duck.State.Idle,
    states: {
      [duck.State.Idle]: {
        on: {
          [duck.Type.TEST]   : duck.State.Responded,
          [duck.Type.GERROR] : duck.State.Errored,
        },
      },
      ...responseStates(childId),
    },
  })

  const parentId = 'parent-id'
  const parentMachine = createMachine({
    id: parentId,
    invoke: {
      id: childId,
      src: childMachine,
    },
    on: {
      [duck.Type.TEST]: {
        actions: [
          actions.send((_, e) => e, { to: childId }),
        ],
      },
      [duck.Type.GERROR]: {
        actions: [
          actions.send((_, e) => e, { to: childId }),
        ],
      },
    },
  })

  const eventList: AnyEventObject[] = []
  const interpreter = interpret(parentMachine)
    .onEvent(e => eventList.push(e))
    .start()

  /**
   * Responded
   */
  const TEST = duck.Event.TEST()
  interpreter.send(TEST)
  await new Promise(resolve => setTimeout(resolve, 0))

  // eventList.forEach(e => console.info(e))
  t.same(
    eventList.filter(isActionOf([
      duck.Event.TEST,
      Mailbox.Event.ACTOR_REPLY,
    ])),
    [
      TEST,
      Mailbox.Event.ACTOR_REPLY(duck.Event.TEST()),
    ],
    'should process TEST with Responded and respond ACTOR_REPLY',
  )

  /**
   * Errored
   */
  eventList.length = 0
  const GERROR = duck.Event.GERROR('test')
  interpreter.send(GERROR)
  await new Promise(resolve => setTimeout(resolve, 0))

  // eventList.forEach(e => console.info(e))
  t.same(
    eventList.filter(isActionOf([
      duck.Event.GERROR,
      Mailbox.Event.ACTOR_REPLY,
    ])),
    [
      GERROR,
      Mailbox.Event.ACTOR_REPLY(GERROR),
    ],
    'should process GERROR with Responded and respond ACTOR_REPLY',
  )

  interpreter.stop()
})
