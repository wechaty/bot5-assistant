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
import { createMachine, actions, AnyEventObject }   from 'xstate'
import * as PUPPET                                  from 'wechaty-puppet'
import * as Mailbox                                 from 'mailbox'
import { GError }                                   from 'gerror'
import { isActionOf }                               from 'typesafe-actions'

import { MessageToText }    from '../../application-actors/mod.js'
import { TextToIntents }    from '../../infrastructure-actors/mod.js'

import duckula, { Context, Event, Events } from './duckula.js'

const machine = createMachine<
  Context,
  Event
>({
  id: duckula.id,
  initial: duckula.State.Initializing,
  states: {
    [duckula.State.Initializing]: {
      always: duckula.State.Idle,
    },

    /**
     *
     * Idle
     *
     * 1. received MESSAGE  -> transition to Loading
     *
     */
    [duckula.State.Idle]: {
      entry: [
        Mailbox.actions.idle(duckula.id),
        actions.assign({ message: undefined }),
      ],
      on: {
        [duckula.Type.MESSAGE]: duckula.State.Loading,
        '*'                   : duckula.State.Idle,
      },
    },

    [duckula.State.Loading]: {
      entry: [
        actions.assign<Context, Events['MESSAGE']>({ message: (_, e) => e.payload.message }),
        actions.log<Context, Events['MESSAGE']>((_, e) => `states.Loading.entry MESSAGE type: ${PUPPET.types.Message[e.payload.message.type]}`, duckula.id),
        actions.send<Context, Events['MESSAGE']>((_, e) => e, { to: ctx => ctx.actors.messageToText }),
      ],
      on: {
        [MessageToText.Type.TEXT]: {
          actions: [
            actions.log((_, e) => `states.Loading.on.TEXT ${e.payload.text}`, duckula.id),
            actions.send((_, e) => e, { to: ctx => ctx.actors.textToIntents }),
          ],
        },
        [TextToIntents.Type.INTENTS] : {
          actions: [
            actions.log((_, e) => `states.Loading.on.INTENTS ${e.payload.intents}`, duckula.id),
          ],
          target: duckula.State.Responding,
        },
        [TextToIntents.Type.GERROR] : duckula.State.Erroring,
        [MessageToText.Type.GERROR] : duckula.State.Erroring,
      },
    },

    [duckula.State.Responding]: {
      entry: [
        actions.log<Context, AnyEventObject>((_, e) => `states.Responding.entry [${e.type}]`, duckula.id),
        Mailbox.actions.reply<Context, Events['INTENTS']>(
          (ctx, e) => duckula.Event.INTENTS(
            e.payload.intents,
            ctx.message,
          ),
        ),
      ],
      always: duckula.State.Idle,
    },

    [duckula.State.Erroring]: {
      entry: [
        actions.log<Context, Events['GERROR']>((_, e) => `states.Erroring.entry GERROR: ${e.payload.gerror}`, duckula.id),
        Mailbox.actions.reply((_, e) => isActionOf(duckula.Event.GERROR, e) ? e : duckula.Event.GERROR(GError.stringify(e))),
      ],
      always: duckula.State.Idle,
    },
  },
})

export default machine
