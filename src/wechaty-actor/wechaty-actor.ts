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
import * as CQRS                    from 'wechaty-cqrs'
import * as UUID                    from 'uuid'
import { actions, createMachine }   from 'xstate'
import { GError }                   from 'gerror'
import { firstValueFrom }           from 'rxjs'
import { ActionType, isActionOf }          from 'typesafe-actions'

import * as Mailbox       from '../mailbox/mod.js'
import { InjectionToken } from '../ioc/tokens.js'

import type { CommandQuery } from './dto.js'

import * as events  from './events.js'
import * as states  from './states.js'
import * as types   from './types.js'

type Event = ActionType<typeof events>

interface Context {
  puppetId : string
}

/**
 * use JSON.parse() to prevent the initial context from being changed
 */
function initialContext (
  puppetId : string,
): Context {
  const context: Context = {
    puppetId,
  }
  return JSON.parse(JSON.stringify(context))
}

const MACHINE_NAME = 'WechatyMachine'

const machineFactory = (
  bus$     : CQRS.Bus,
  puppetId : string,
) => createMachine<Context, Event>({
  /**
   * Introducing: TypeScript typegen for XState
   *  @link https://stately.ai/blog/introducing-typescript-typegen-for-xstate
   */
  // tsTypes: {},
  // schema: {
  //   context: {} as Context,
  //   events: {} as Event,
  // },

  /**
   * Issue statelyai/xstate#2891:
   *  The context provided to the expr inside a State
   *  should be exactly the **context in this state**
   * @see https://github.com/statelyai/xstate/issues/2891
   */
  preserveActionOrder: true,

  id: MACHINE_NAME,
  context: initialContext(puppetId),
  initial: states.idle,
  states: {
    [states.idle]: {
      entry: [
        actions.log('state.idle.entry', MACHINE_NAME),
        Mailbox.Actions.idle(MACHINE_NAME)('idle'),
      ],
      on: {
        // '*': states.idle, // must have a external transition for all events to trigger the Mailbox state transition
        '*': states.preparing,
      },
    },

    [states.preparing]: {
      entry: [
        actions.log('state.preparing.entry', MACHINE_NAME),
        actions.choose([
          {
            cond: (_, e) => CQRS.is(
              Object.values({
                ...CQRS.commands,
                ...CQRS.queries,
              }),
            )(e),
            actions: [
              actions.log((_, e) => `states.preparing.entry execute Command/Query [${e.type}]`),
              actions.send((_, e) => events.execute(e as CommandQuery)),
            ],
          },
          {
            actions: [
              actions.log((_, e) => `states.preparing.entry skip non-Command/Query [${e.type}]`),
              actions.send(events.idle()),
            ],
          },
        ]),
      ],
      on: {
        [types.IDLE]    : states.idle,
        [types.EXECUTE] : states.executing,
      },
    },

    [states.executing]: {
      entry: [
        actions.log((_, e) => `state.executing.entry -> [${e.type}]`, MACHINE_NAME),
      ],
      invoke: {
        src: 'execute',
        onDone: {
          actions: [
            actions.send((_, e) => events.response(e.data)),
          ],
        },
        onError: {
          actions: [
            actions.send((ctx: any, e) => events.response(
              CQRS.events.ErrorReceivedEvent(ctx.puppetId, { data: GError.stringify(e.data) }),
            )),
          ],
        },
      },
      on: {
        [types.RESPONSE]: states.responding,
      },
    },

    [states.responding]: {
      entry: [
        actions.log((_, e) => `states.responding.entry <- [${e.type}]`),
        Mailbox.Actions.reply((_, e) => e),
      ],
      always: states.idle,
    },

  },
}, {
  services: {
    execute: (ctx, e) => {
      if (!isActionOf(events.execute)(e)) {
        throw new Error(`${MACHINE_NAME} state.executing.invoke: unknown event [${e.type}]`)
      }

      const commandQuery = e.payload.commandQuery

      if (commandQuery.meta.puppetId === UUID.NIL) {
        commandQuery.meta.puppetId = ctx.puppetId
      } else if (commandQuery.meta.puppetId !== ctx.puppetId) {
        throw new Error(`${MACHINE_NAME} state.executing.invoke: puppetId mismatch. (given: "${commandQuery.meta.puppetId}", expected: "${ctx.puppetId}")`)
      }

      return firstValueFrom(
        CQRS.execute$(bus$)(commandQuery),
      )
    },
  },
})

wechatyActorFactory.inject = [
  InjectionToken.WechatyCqrsBus$,
  InjectionToken.Logger,
] as const

function wechatyActorFactory (
  bus$     : CQRS.Bus,
  puppetId : string,
  logger?  : Mailbox.Options['logger'],
) {
  const machine = machineFactory(bus$, puppetId)
  const mailbox = Mailbox.from(machine, { logger })

  mailbox.acquire()
  return mailbox
}

export {
  type Event,
  type Context,
  machineFactory,
  wechatyActorFactory,
  initialContext,
}
