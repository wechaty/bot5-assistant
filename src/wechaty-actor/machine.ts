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
import { actions, createMachine }   from 'xstate'
import { GError }                   from 'gerror'
import { isActionOf }               from 'typesafe-actions'
import * as Mailbox                 from 'mailbox'

import * as duck        from './duck/mod.js'
import * as services    from './services/mod.js'

import type { CommandQuery }    from './dto.js'

export const factory = (
  bus$     : CQRS.Bus,
  puppetId : string,
) => createMachine<duck.Context, duck.Event[keyof duck.Event]>({
  id: duck.ID,
  context: duck.initialContext(puppetId),
  initial: duck.State.Idle,
  states: {
    [duck.State.Idle]: {
      entry: [
        actions.log('state.idle.entry', duck.ID),
        Mailbox.actions.idle(duck.ID)('idle'),
      ],
      on: {
        // '*': duck.State.idle, // must have a external transition for all events to trigger the Mailbox state transition
        '*': duck.State.Preparing,
      },
    },

    [duck.State.Preparing]: {
      entry: [
        actions.log('state.preparing.entry', duck.ID),
        actions.choose([
          {
            cond: (_, e) => CQRS.is(
              Object.values({
                ...CQRS.commands,
                ...CQRS.queries,
              }),
            )(e),
            actions: [
              actions.log((_, e) => `State.preparing.entry execute Command/Query [${e.type}]`, duck.ID),
              actions.send((_, e) => duck.Event.EXECUTE(e as CommandQuery)),
            ],
          },
          {
            cond: (_, e) => isActionOf(duck.Event.BATCH, e),
            actions: [
              actions.log('State.preparing.entry execute batch', duck.ID),
              actions.send((_, e) => e), // <- duck.Event.batch / types.BATCH
            ],
          },
          {
            actions: [
              actions.log((_, e) => `State.preparing.entry skip non-Command/Query [${e.type}]`, duck.ID),
              actions.send(duck.Event.IDLE()),
            ],
          },
        ]),
      ],
      on: {
        [duck.Type.IDLE]    : duck.State.Idle,
        [duck.Type.EXECUTE] : duck.State.Executing,
        [duck.Type.BATCH]   : duck.State.Batching,
      },
    },

    [duck.State.Executing]: {
      entry: [
        actions.log((_, e) => `state.executing.entry -> [${e.type}]`, duck.ID),
      ],
      invoke: {
        src: 'execute',
        onDone: {
          actions: [
            actions.send((_, e) => duck.Event.RESPONSE(e.data)),
          ],
        },
        onError: {
          actions: [
            actions.send((ctx: any, e) => duck.Event.RESPONSE(
              CQRS.events.ErrorReceivedEvent(ctx.puppetId, { data: GError.stringify(e.data) }),
            )),
          ],
        },
      },
      on: {
        [duck.Type.RESPONSE]: duck.State.Responding,
      },
    },

    [duck.State.Batching]: {
      entry: [
        actions.log((_, e) => [
          'State.batching.entry -> ',
          `[${[ ...new Set((e as duck.Event['BATCH']).payload.commandQueryList.map(cq => cq.type)) ].join(',')}] `,
          `#${(e as duck.Event['BATCH']).payload.commandQueryList.length}`,
        ].join(''), duck.ID),
      ],
      invoke: {
        src: 'batch',
        onDone: {
          actions: [
            actions.send((_, e) => duck.Event.BATCH_RESPONSE(e.data)),
          ],
        },
        onError: {
          actions: [
            actions.send((ctx: any, e) => duck.Event.BATCH_RESPONSE([
              // TODO: how to make the length the same as the batached request?
              CQRS.events.ErrorReceivedEvent(ctx.puppetId, { data: GError.stringify(e.data) }),
            ])),
          ],
        },
      },
      on: {
        [duck.Type.BATCH_RESPONSE]: duck.State.Responding,
      },
    },

    [duck.State.Responding]: {
      entry: [
        actions.log((_, e) => `State.responding.entry <- [${e.type}]`, duck.ID),
        Mailbox.actions.reply((_, e) => e),
      ],
      always: duck.State.Idle,
    },

  },
}, {
  /**
   * FIXME: batch is never used in the machine definition
   */
  services: {
    batch   : (ctx, e) => services.batch(bus$)(ctx, e),
    execute : services.execute(bus$),
  },
})
