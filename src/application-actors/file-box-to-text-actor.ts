/* eslint-disable sort-keys */
import { createMachine, actions }   from 'xstate'
import * as Mailbox                 from 'mailbox'
import { GError }                   from 'gerror'
import { FileBox }                  from 'file-box'

import { speechToText }   from '../to-text/mod.js'
import * as duck          from '../duck/mod.js'
import { duckularize }    from '../duckula/duckularize.js'

const duckula = duckularize({
  id:  'FileBoxToTextMachine',
  events: [ duck.Event, [
    /**
     * @request
     */
    'FILE_BOX',
    /**
     * @response
     */
    'TEXT',
    'GERROR',
  ] ],
  states: [ duck.State, [
    'Idle',
    'recognizing',
    'responding',
  ] ],
  initialContext: ({}),
})

const machine = createMachine<
  ReturnType<typeof duckula.initialContext>,
  ReturnType<typeof duckula.Event[keyof typeof duckula.Event]>
>({
  id: duckula.ID,
  initial: duckula.State.Idle,
  states: {
    [duckula.State.Idle]: {
      entry: [
        Mailbox.actions.idle(duckula.ID)('idle'),
      ],
      on: {
        [duckula.Type.FILE_BOX]: duckula.State.recognizing,
      },
    },
    [duckula.State.recognizing]: {
      entry: [
        actions.log((_, e) => `states.recognizing.entry fileBox: "${JSON.parse((e as ReturnType<typeof duckula.Event['FILE_BOX']>).payload.fileBox).name}"`, duckula.ID),
      ],
      invoke: {
        src: (_, e) => speechToText(FileBox.fromJSON(
          (e as ReturnType<typeof duckula.Event['FILE_BOX']>).payload.fileBox,
        )),
        onDone: {
          actions: [
            actions.log((_, e) => `states.recognizing.invoke.onDone "${e.data}"`, duckula.ID),
            actions.send((_, e) => duckula.Event.TEXT(e.data)),
          ],
        },
        onError: {
          actions: [
            actions.log((_, e) => `states.recognizing.invoke.onError "${e.data}"`, duckula.ID),
            actions.send((_, e) => duckula.Event.GERROR(GError.stringify(e.data))),
          ],
        },
      },
      on: {
        [duckula.Type.TEXT]: duckula.State.responding,
        [duckula.Type.GERROR]: duckula.State.responding,
      },
    },
    [duckula.State.responding]: {
      entry: [
        actions.log((_, e) => `states.responding.entry "${JSON.stringify(e)}"`, duckula.ID),
        Mailbox.actions.reply((_, e) => e),
      ],
      always: duckula.State.Idle,
    },
  },
})

duckula.machine = machine
export default duckula as Required<typeof duckula>
