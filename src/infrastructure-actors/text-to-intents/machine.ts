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
import { isActionOf }               from 'typesafe-actions'
import { GError }                   from 'gerror'

import * as duck    from '../../duck/mod.js'

import { textToIntents }    from './text-to-intents.js'

import duckula, { Context, Event, Events }    from './duckula.js'

const machine = createMachine<
  Context,
  Event
>({
  id: duckula.id,
  context: duckula.initialContext,

  initial: duckula.State.Idle,
  states: {

    /**
     *
     * Idle
     *
     * 1. received TEXT -> transition to Understanding
     *
     */

    [duckula.State.Idle]: {
      entry: [
        actions.log('states.Idle.entry', duckula.id),
        Mailbox.actions.idle(duckula.id),
      ],
      on: {
        [duckula.Type.TEXT]: duckula.State.Understanding,
        '*': duckula.State.Idle,
      },
    },

    /**
     *
     * Understanding
     *
     * 1. received TEXT         -> invoke textToIntents
     * 2. received invoke.done  -> emit INTENTS
     * 3. received invoke.error -> emit GERROR
     *
     * 4. received INTENTS  -> transition to Responding
     * 5. received GERROR   -> transition to Erroring
     *
     */
    [duckula.State.Understanding]: {
      entry: [
        actions.log<Context, Events['TEXT']>((_, e) => `states.Understanding.entry TEXT: "${e.payload.text}"`, duckula.id),
      ],
      invoke: {
        src: (_, e) => isActionOf(duckula.Event.TEXT, e)
          ? textToIntents(e.payload.text)
          : () => { throw new Error(`isActionOf(${e.type}) unexpected.`) },
        onDone: {
          actions: actions.send((_, e) => duckula.Event.INTENTS(e.data || [ duck.Intent.Unknown ])),
        },
        onError: {
          actions: actions.send((_, e) => duckula.Event.GERROR(GError.stringify(e.data))),
        },
      },
      on: {
        [duckula.Type.INTENTS] : duckula.State.Responding,
        [duckula.Type.GERROR]  : duckula.State.Erroring,
      },
    },

    [duckula.State.Responding]: {
      entry: [
        actions.log<Context, Events['INTENTS']>((_, e) => `states.Responding.entry [${e.type}]: ${e.payload.intents}`, duckula.id),
        Mailbox.actions.reply((_, e) => e),
      ],
      always: duckula.State.Idle,
    },

    [duckula.State.Erroring]: {
      entry: [
        actions.log<Context, Events['GERROR']>((_, e) => `states.Erroring.entry [${e.type}] ${e.payload.gerror}`, duckula.id),
        Mailbox.actions.reply((_, e) => isActionOf(duckula.Event.GERROR, e) ? e : duckula.Event.GERROR(GError.stringify(e))),
      ],
      always: duckula.State.Idle,
    },

  },
})

export default machine
