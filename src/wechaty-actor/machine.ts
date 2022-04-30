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

import * as services    from './services/mod.js'

import type { CommandQuery }    from './dto.js'
import duckula, { Context }     from './duckula.js'

const machine = createMachine<
  ReturnType<typeof duckula.initialContext>,
  ReturnType<typeof duckula.Event[keyof typeof duckula.Event]>
>({
  id: duckula.id,
  initial: duckula.State.Idle,
  states: {
    [duckula.State.Idle]: {
      entry: [
        actions.log('states.Idle.entry', duckula.id),
        Mailbox.actions.idle(duckula.id),
      ],
      on: {
        /**
         * Wechaty Actor accepts and responses:
         *
         *  1. CQRS.commands.* & CQRS.queries.*
         *  2. BATCH()
         */
        '*': duckula.State.Classifying,
      },
    },

    /**
     *
     * Classifying EVENTs
     *
     * 1. received CQRS.commands.* & CQRS.queries.*  -> emit EXECUTE
     * 2. received BATCH_EXECUTE                     -> emit BATCH_EXECUTE
     * 3. '*'                                        -> emit IDLE
     *
     * 4. received EXECUTE        -> tarnsit to Executing
     * 5. received BATCH_EXECUTE  -> transit to Executing
     * 6. received IDLE           -> transit to Idle
     *
     */
    [duckula.State.Classifying]: {
      entry: [
        actions.log('states.Classifying.entry', duckula.id),
        actions.choose([
          {
            cond: (_, e) => CQRS.is(
              Object.values({
                ...CQRS.commands,
                ...CQRS.queries,
              }),
              e,
            ),
            actions: [
              actions.log((_, e) => `states.Classifying.entry found Command/Query [${e.type}]`, duckula.id),
              actions.send((_, e) => duckula.Event.EXECUTE(e as CommandQuery)),
            ],
          },
          {
            cond: (_, e) => isActionOf(duckula.Event.BATCH_EXECUTE, e),
            actions: [
              actions.log('states.Classifying.entry found BATCH', duckula.id),
              actions.send((_, e) => e), // <- duckula.Event.batch / types.BATCH
            ],
          },
          {
            actions: [
              actions.log((_, e) => `states.Classifying.entry neither BATCH nor Command/Query, ignore [${e.type}]`, duckula.id),
              actions.send(duckula.Event.IDLE()),
            ],
          },
        ]),
      ],
      on: {
        [duckula.Type.IDLE]          : duckula.State.Idle,
        [duckula.Type.EXECUTE]       : duckula.State.Executing,
        [duckula.Type.BATCH_EXECUTE] : duckula.State.Batching,
      },
    },

    /**
     *
     * Execute CQRS.commands.* & CQRS.queries.*
     *
     * 1. received EXECUTE -> emit RESPONSE
     *
     */
    [duckula.State.Executing]: {
      entry: [
        actions.log((_, e) => [
          'states.Executing.entry EXECUTE [',
          (e as ReturnType<typeof duckula.Event['EXECUTE']>)
            .payload
            .commandQuery
            .type,
          ']',
        ].join(''), duckula.id),
      ],
      invoke: {
        src: 'execute',
        onDone:   { actions: actions.send((_, e) => duckula.Event.RESPONSE(e.data)) },
        onError:  { actions: actions.send((_, e) => duckula.Event.GERROR(GError.stringify(e.data))) },
      },
      on: {
        [duckula.Type.RESPONSE] : duckula.State.Responding,
        [duckula.Type.GERROR]   : duckula.State.Erroring,
      },
    },

    /**
     *
     * Response CQRS.commands.* & CQRS.queries.*
     *
     * Unwrap the RESPONSE and emit CQRS.responses.*
     *  1. received RESPONSE -> emit [RESPONSE].payload.response
     *  2. transit to Idle
     *
     */
    [duckula.State.Responding]: {
      entry: [
        actions.log<Context, ReturnType<typeof duckula.Event.RESPONSE>>(
          (_, e) => `states.Responding.entry RESPONSE [${e.payload.response.type}]`,
          duckula.id,
        ),
        Mailbox.actions.reply<Context, ReturnType<typeof duckula.Event.RESPONSE>>(
          (_, e) => e.payload.response,
        ),
      ],
      always: duckula.State.Idle,
    },

    /**
     *
     * Batch Execute CQRS.commands.* & CQRS.queries.*
     *
     */
    [duckula.State.Batching]: {
      entry: [
        actions.log((_, e) => [
          'states.Batching.entry BATCH [',
          [
            ...new Set(
              (e as ReturnType<typeof duckula.Event['BATCH_EXECUTE']>)
                .payload
                .commandQueryList
                .map(cq => cq.type),
            ),
          ].join(','),
          ']#',
          (e as ReturnType<typeof duckula.Event['BATCH_EXECUTE']>)
            .payload
            .commandQueryList
            .length,
        ].join(''), duckula.id),
      ],
      invoke: {
        src: 'batch',
        onDone:   { actions: actions.send((_, e) => duckula.Event.BATCH_RESPONSE(e.data)) },
        onError:  { actions: actions.send((_, e) => duckula.Event.GERROR(GError.stringify(e.data))) },
      },
      on: {
        [duckula.Type.BATCH_RESPONSE] : duckula.State.BatchResponding,
        [duckula.Type.GERROR]         : duckula.State.Erroring,
      },
    },

    /**
     *
     * Batch Response CQRS.commands.* & CQRS.queries.*
     *
     */
    [duckula.State.BatchResponding]: {
      entry: [
        actions.log((_, e) => [
          `states.BatchResponding.entry ${e.type} [`,
          CQRS.is(duckula.Event.BATCH_RESPONSE, e)
            ? [ ...new Set(
                e.payload.responseList
                  .map(r => r.type),
              ) ].join(',')
            : e.type,
          ']',
        ].join(''), duckula.id),
        Mailbox.actions.reply((_, e) => e),
      ],
      always: duckula.State.Idle,
    },

    [duckula.State.Erroring]: {
      entry: [
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
