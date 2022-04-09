/* eslint-disable sort-keys */
import { createMachine, actions }   from 'xstate'
import * as Mailbox                 from 'mailbox'
import { GError }                   from 'gerror'
import { FileBox }                  from 'file-box'

import { speechToText }   from '../to-text/mod.js'
import * as duck          from '../duck/mod.js'

const Event = {
  FILE_BOX : duck.Event.FILE_BOX,
  GERROR   : duck.Event.GERROR,
  TEXT     : duck.Event.TEXT,
} as const

// eslint-disable-next-line no-redeclare
type Event = {
  [key in keyof typeof Event]: ReturnType<typeof Event[key]>
}

const Type = {
  FILE_BOX : duck.Type.FILE_BOX,
  GERROR   : duck.Type.GERROR,
  TEXT     : duck.Type.TEXT,
} as const
// eslint-disable-next-line no-redeclare
type Type = typeof Type[keyof typeof Type]

const State = {
  Idle        : duck.State.Idle,
  recognizing : duck.State.recognizing,
  responding  : duck.State.responding,
} as const
// eslint-disable-next-line no-redeclare
type State = typeof State[keyof typeof State]

interface Context {}

const initialContext = (): Context => {
  const context: Context = {}
  return JSON.parse(JSON.stringify(context))
}

const NAME = 'FileBoxToTextMachine'

/**
 * @request
 *  - events.FILE_BOX
 *
 * @response
 *  success: events.TEXT
 *  failure: events.GERROR
 */
const machine = createMachine<Context, Event[keyof Event]>({
  id: NAME,
  initial: State.Idle,
  states: {
    [State.Idle]: {
      entry: [
        Mailbox.actions.idle(NAME)('idle'),
      ],
      on: {
        [Type.FILE_BOX]: State.recognizing,
      },
    },
    [State.recognizing]: {
      entry: [
        actions.log((_, e) => `states.recognizing.entry fileBox: "${JSON.parse((e as Event['FILE_BOX']).payload.fileBox).name}"`, NAME),
      ],
      invoke: {
        src: (_, e) => speechToText(FileBox.fromJSON(
          (e as Event['FILE_BOX']).payload.fileBox,
        )),
        onDone: {
          actions: [
            actions.log((_, e) => `states.recognizing.invoke.onDone "${e.data}"`, NAME),
            actions.send((_, e) => Event.TEXT(e.data)),
          ],
        },
        onError: {
          actions: [
            actions.log((_, e) => `states.recognizing.invoke.onError "${e.data}"`, NAME),
            actions.send((_, e) => Event.GERROR(GError.stringify(e.data))),
          ],
        },
      },
      on: {
        [Type.TEXT]: State.responding,
        [Type.GERROR]: State.responding,
      },
    },
    [State.responding]: {
      entry: [
        actions.log((_, e) => `states.responding.entry "${JSON.stringify(e)}"`, NAME),
        Mailbox.actions.reply((_, e) => e),
      ],
      always: State.Idle,
    },
  },
})

export {
  NAME,
  Type,
  Event,
  State,
  machine,
  type Context,
  initialContext,
}
