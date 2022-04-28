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

import { speechToText }   from './speech-to-text.js'
import duckula            from './duckula.js'

const machine = createMachine<
  ReturnType<typeof duckula.initialContext>,
  ReturnType<typeof duckula.Event[keyof typeof duckula.Event]>
>({
  id: duckula.id,
  initial: duckula.State.Idle,
  context: duckula.initialContext,
  states: {
    [duckula.State.Idle]: {
      entry: [
        Mailbox.actions.idle(duckula.id),
      ],
      on: {
        [duckula.Type.FILE_BOX]: duckula.State.Recognizing,
      },
    },
    [duckula.State.Recognizing]: {
      entry: [
        actions.log((_, e) => `states.Recognizing.entry fileBox: "${(e as ReturnType<typeof duckula.Event['FILE_BOX']>).payload.fileBox.name}"`, duckula.id),
      ],
      invoke: {
        src: (_, e) => speechToText(
          (e as ReturnType<typeof duckula.Event['FILE_BOX']>).payload.fileBox,
        ),
        onDone: {
          actions: [
            actions.log((_, e) => `states.recognizing.invoke.onDone "${e.data}"`, duckula.id),
            actions.send((_, e) => duckula.Event.TEXT(e.data)),
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
        [duckula.Type.TEXT]   : duckula.State.Responding,
        [duckula.Type.GERROR] : duckula.State.Erroring,
      },
    },

    [duckula.State.Responding]: {
      entry: [
        actions.log((_, e) => `states.Responding.entry "${JSON.stringify(e)}"`, duckula.id),
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
})

export default machine
