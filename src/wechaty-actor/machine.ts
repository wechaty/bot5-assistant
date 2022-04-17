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

import * as services      from './services/mod.js'

import type { CommandQuery }    from './dto.js'
import duckula                  from './duckula.js'

const machine = createMachine<
  ReturnType<typeof duckula.initialContext>,
  ReturnType<typeof duckula.Event[keyof typeof duckula.Event]>
>({
  id: duckula.ID,
  initial: duckula.State.Idle,
  states: {
    [duckula.State.Idle]: {
      entry: [
        actions.log('state.idle.entry', duckula.ID),
        Mailbox.actions.idle(duckula.ID)('idle'),
      ],
      on: {
        // '*': duckula.State.idle, // must have a external transition for all events to trigger the Mailbox state transition
        '*': duckula.State.Preparing,
      },
    },

    [duckula.State.Preparing]: {
      entry: [
        actions.log('state.preparing.entry', duckula.ID),
        actions.choose([
          {
            cond: (_, e) => CQRS.is(
              Object.values({
                ...CQRS.commands,
                ...CQRS.queries,
              }),
            )(e),
            actions: [
              actions.log((_, e) => `State.preparing.entry execute Command/Query [${e.type}]`, duckula.ID),
              actions.send((_, e) => duckula.Event.EXECUTE(e as CommandQuery)),
            ],
          },
          {
            cond: (_, e) => isActionOf(duckula.Event.BATCH, e),
            actions: [
              actions.log('State.preparing.entry execute batch', duckula.ID),
              actions.send((_, e) => e), // <- duckula.Event.batch / types.BATCH
            ],
          },
          {
            actions: [
              actions.log((_, e) => `State.preparing.entry skip non-Command/Query [${e.type}]`, duckula.ID),
              actions.send(duckula.Event.IDLE()),
            ],
          },
        ]),
      ],
      on: {
        [duckula.Type.IDLE]    : duckula.State.Idle,
        [duckula.Type.EXECUTE] : duckula.State.Executing,
        [duckula.Type.BATCH]   : duckula.State.Batching,
      },
    },

    [duckula.State.Executing]: {
      entry: [
        actions.log((_, e) => `state.executing.entry -> [${e.type}]`, duckula.ID),
      ],
      invoke: {
        src: 'execute',
        onDone: {
          actions: [
            actions.send((_, e) => duckula.Event.RESPONSE(e.data)),
          ],
        },
        onError: {
          actions: [
            actions.send((ctx: any, e) => duckula.Event.RESPONSE(
              CQRS.events.ErrorReceivedEvent(ctx.puppetId, { data: GError.stringify(e.data) }),
            )),
          ],
        },
      },
      on: {
        [duckula.Type.RESPONSE]: duckula.State.Responding,
      },
    },

    [duckula.State.Batching]: {
      entry: [
        actions.log((_, e) => [
          'State.batching.entry -> ',
          `[${[ ...new Set((e as ReturnType<typeof duckula.Event['BATCH']>).payload.commandQueryList.map(cq => cq.type)) ].join(',')}] `,
          `#${(e as ReturnType<typeof duckula.Event['BATCH']>).payload.commandQueryList.length}`,
        ].join(''), duckula.ID),
      ],
      invoke: {
        src: 'batch',
        onDone: {
          actions: [
            actions.send((_, e) => duckula.Event.BATCH_RESPONSE(e.data)),
          ],
        },
        onError: {
          actions: [
            actions.send((ctx: any, e) => duckula.Event.BATCH_RESPONSE([
              // TODO: how to make the length the same as the batached request?
              CQRS.events.ErrorReceivedEvent(ctx.puppetId, { data: GError.stringify(e.data) }),
            ])),
          ],
        },
      },
      on: {
        [duckula.Type.BATCH_RESPONSE]: duckula.State.Responding,
      },
    },

    [duckula.State.Responding]: {
      entry: [
        actions.log((_, e) => `State.responding.entry <- [${e.type}]`, duckula.ID),
        Mailbox.actions.reply((_, e) => e),
      ],
      always: duckula.State.Idle,
    },

  },
}, {
  /**
   * FIXME: batch is never used in the machine definition
   */
  services: {
    batch   : (ctx, e) => services.batch(ctx, e),
    execute : services.execute,
  },
})

export default machine
