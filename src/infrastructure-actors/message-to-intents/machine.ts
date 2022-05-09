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
import { GError }                   from 'gerror'
import * as PUPPET                  from 'wechaty-puppet'

import { responseStates }     from '../../actor-utils/response-states.js'
import { TextToIntents }      from '../../infrastructure-actors/mod.js'

import * as MessageToText   from '../message-to-text/mod.js'

import duckula, { Context, Event, Events }  from './duckula.js'

const machine = createMachine<Context, Event>({
  id: duckula.id,
  initial: duckula.State.Initializing,
  states: {
    [duckula.State.Initializing]: {
      entry: [
        actions.log(ctx => `states.Initializing.entry context ${JSON.stringify(ctx)}`, duckula.id),
      ],
      always: duckula.State.Idle,
    },

    /**
     *
     * Idle
     *
     *  1. receive MESSAGE -> transition to Filing
     *
     */
    [duckula.State.Idle]: {
      entry: [
        actions.assign({ message: undefined }),
        Mailbox.actions.idle(duckula.id),
      ],
      on: {
        [duckula.Type.MESSAGE]: {
          actions: actions.assign({ message: (_, e) => e.payload.message }),
          target: duckula.State.Textualizing,
        },
      },
    },

    /**
     * Textualizing
     *
     * 1. received MESSAGE -> emit TEXT / NO_TEXT / GERROR
     *
     * 2. received TEXT    -> transition to Understanding
     * 3. received NO_TEXT -> transition to Idle
     */
    [duckula.State.Textualizing]: {
      invoke: {
        id: MessageToText.id + '<' + duckula.id + '>',
        src: ctx => Mailbox.wrap(
          MessageToText.machine.withContext({
            ...MessageToText.initialContext(),
            actors: {
              wechaty: ctx.actors.wechaty,
            },
          }),
        ),
        onDone:  { actions: actions.send((_, e) => duckula.Event.GERROR(GError.stringify(e.data))) },
        onError: { actions: actions.send((_, e) => duckula.Event.GERROR(GError.stringify(e.data))) },
      },
      entry: [
        actions.log<Context, Events['MESSAGE']>(
          (_, e) => `state.Textualizing.entry MessageType: ${PUPPET.types.Message[e.payload.message.type]}`,
          duckula.id,
        ),
        actions.send((_, e) => e, { to: MessageToText.id + '<' + duckula.id + '>' }),
      ],
      on: {
        [duckula.Type.NO_TEXT]: {
          actions: actions.send(duckula.Event.INTENTS([])),
        },
        [duckula.Type.TEXT]    : duckula.State.Understanding,
        [duckula.Type.INTENTS] : duckula.State.Understood,
        [duckula.Type.GERROR]  : duckula.State.Erroring,
      },
    },

    /**
     * Understanding
     *
     * 1. received TEXT    -> emit INTENTS
     */
    [duckula.State.Understanding]: {
      invoke: {
        id: TextToIntents.id + '<' + duckula.id + '>',
        src: Mailbox.wrap(
          TextToIntents.machine.withContext(TextToIntents.initialContext()),
        ),
        onDone:  { actions: actions.send((_, e) => duckula.Event.GERROR(GError.stringify(e.data))) },
        onError: { actions: actions.send((_, e) => duckula.Event.GERROR(GError.stringify(e.data))) },
      },
      entry: [
        actions.log<Context, Events['TEXT']>((_, e) => `state.Understanding.entry TEXT: ${e.payload.text}`, duckula.id),
        actions.send((_, e) => e, { to: TextToIntents.id + '<' + duckula.id + '>' }),
      ],
      on: {
        [duckula.Type.INTENTS] : duckula.State.Understood,
        [duckula.Type.GERROR]  : duckula.State.Erroring,
      },
    },

    [duckula.State.Understood]: {
      entry: actions.send<Context, Events['INTENTS']>((ctx, e) => ({
        ...e,
        payload: {
          ...e.payload,
          message: ctx.message,
        },
      })),
      on: {
        [duckula.Type.INTENTS]: duckula.State.Responding,
      },
    },

    ...responseStates(duckula.id),
  },
})

export default machine
