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

import { responseStates }     from '../../pure/mod.js'

import { textToDate }                         from './text-to-date.js'
import duckula, { Context, Event, Events }    from './duckula.js'

const machine = createMachine<Context, Event>({
  id: duckula.id,
  context: duckula.initialContext,

  initial: duckula.State.Initializing,
  states: {
    [duckula.State.Initializing]: {
      entry: [
        actions.log(ctx => `states.Initializing.entry context ${JSON.stringify(ctx)}`, duckula.id),
      ],
      always: duckula.State.Idle,
    },

    [duckula.State.Idle]: {
      entry: [
        Mailbox.actions.idle(duckula.id),
      ],
      on: {
        [duckula.Type.TEXT]: duckula.State.Recognizing,
      },
    },
    [duckula.State.Recognizing]: {
      entry: [
        actions.log<Context, Events['TEXT']>((_, e) => `states.Recognizing.entry TEXT "${e.payload.text}"`, duckula.id),
      ],
      invoke: {
        src: (_, e) => textToDate((e as Events['TEXT']).payload.text),
        onDone: {
          actions: [
            actions.log((_, e) => `states.recognizing.invoke.onDone "${e.data}"`, duckula.id),
            actions.send((_, e) => e.data instanceof Date
              ? duckula.Event.DATE(+e.data)
              : duckula.Event.NO_DATE()
              ,
            ),
          ],
        },
        onError: {
          actions: [
            actions.log((_, e) => `states.recognizing.invoke.onError "${e.data}"`, duckula.id),
            actions.send((_, e) => duckula.Event.GERROR(GError.stringify(e.data))),
          ],
        },
      },
      on: {
        [duckula.Type.DATE]    : duckula.State.Responding,
        [duckula.Type.NO_DATE] : duckula.State.Responding,
        [duckula.Type.GERROR]  : duckula.State.Erroring,
      },
    },

    ...responseStates(duckula.id),
  },
})

export default machine
