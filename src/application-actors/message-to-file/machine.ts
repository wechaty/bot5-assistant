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
import { createMachine, actions }   from 'xstate'
import * as Mailbox                 from 'mailbox'
import * as CQRS                    from 'wechaty-cqrs'

import { responseStates }   from '../../actor-utils/mod.js'

import duckula, { Context, Event, Events }    from './duckula.js'
import { fileMessageTypes }                   from './file-message-types.js'

const machine = createMachine<
  Context,
  Event
>({
  id: duckula.id,
  initial: duckula.State.Idle,
  context: duckula.initialContext,
  states: {

    /**
     *
     * Idle
     *
     *  1. receive MESSAGE -> transition to Classifying
     *
     */
    [duckula.State.Idle]: {
      entry: [
        Mailbox.actions.idle(duckula.id),
        actions.assign({ message: undefined }),
      ],
      on: {
        [duckula.Type.MESSAGE]: {
          actions: actions.assign({ message: (_, e) => e.payload.message }),
          target: duckula.State.Classifying,
        },
      },
    },

    /**
     * Classifying
     *
     *  1. received MESSAGE -> TEXT / LOAD
     */

    [duckula.State.Classifying]: {
      entry: [
        actions.log('states.Classifying.entry', duckula.id),
        actions.choose<
          Context,
          Events['MESSAGE']
        >([
          {
            cond: (_, e) => fileMessageTypes.includes(e.payload.message.type),
            actions: actions.send((_, e) => e),
          },
          {
            actions: actions.send(duckula.Event.NO_FILE()),
          },
        ]),
      ],
      on: {
        [duckula.Type.MESSAGE] : duckula.State.Loading,
        [duckula.Type.GERROR]  : duckula.State.Erroring,
        [duckula.Type.NO_FILE]  : duckula.State.Loaded,
      },
    },

    /**
     * Load
     *
     *  1. received MESSAGE                         -> emit GET_MESSAGE_FILE_QUERY_RESPONSE
     *  2. received GET_MESSAGE_FILE_QUERY_RESPONSE -> emit FILE_BOX / GERROR
     *
     *  3. received FILE_BOX -> transition to Loaded
     *  4. received GERROR   -> transition to Erroring
     */
    [duckula.State.Loading]: {
      entry: [
        actions.log('states.Loading.entry', duckula.id),
        actions.send<Context, Events['MESSAGE']>(
          (_, e) => CQRS.duck.actions.GET_MESSAGE_FILE_QUERY(
            CQRS.uuid.NIL,
            e.payload.message.id,
          ),
          { to: ctx => ctx.actors.wechaty },
        ),
      ],
      on: {
        '*': {
          actions: [
            actions.log((_, e) => `states.Loading.on.* ${JSON.stringify(e)}`, duckula.id),
          ],
        },
        [duckula.Type.GET_MESSAGE_FILE_QUERY_RESPONSE]: {
          actions: [
            actions.log('states.Loading.on.GET_MESSAGE_FILE_QUERY_RESPONSE', duckula.id),
            actions.send((_, e) => e.payload.file
              ? duckula.Event.FILE(e.payload.file)
              : duckula.Event.NO_FILE()
              ,
            ),
          ],
        },
        [duckula.Type.FILE]    : duckula.State.Loaded,
        [duckula.Type.NO_FILE] : duckula.State.Loaded,
        [duckula.Type.GERROR]  : duckula.State.Erroring,
      },
    },

    [duckula.State.Loaded]: {
      entry: [
        actions.log((_, e) => `states.Loaded.entry [${e.type}]`, duckula.id),
        actions.send<Context, Events['FILE'] | Events['NO_FILE']>(
          (ctx, e) => ({
            ...e,
            payload: {
              ...e.payload,
              message: ctx.message,
            },
          }),
        ),
      ],
      on: {
        [duckula.Type.FILE]    : duckula.State.Responding,
        [duckula.Type.NO_FILE] : duckula.State.Responding,
      },
    },

    ...responseStates(duckula.id),
  },
})

export default machine
