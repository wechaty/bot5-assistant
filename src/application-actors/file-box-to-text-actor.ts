/* eslint-disable sort-keys */
import { createMachine, actions }   from 'xstate'
import * as Mailbox                 from 'mailbox'
import { GError }                   from 'gerror'
import { FileBox }                  from 'file-box'

import { speechToText }   from '../to-text/mod.js'
import * as schemas       from '../schemas/mod.js'

const events = {
  FILE_BOX : schemas.events.FILE_BOX,
  GERROR   : schemas.events.GERROR,
  TEXT     : schemas.events.TEXT,
} as const

type Event =
  | ReturnType<typeof events[keyof typeof events]>

type Events = {
  [key in keyof typeof events]: ReturnType<typeof events[key]>
}

const types = {
  FILE_BOX : schemas.types.FILE_BOX,
  GERROR   : schemas.types.GERROR,
  TEXT     : schemas.types.TEXT,
} as const

const states = {
  idle        : schemas.states.idle,
  recognizing : schemas.states.recognizing,
  responding  : schemas.states.responding,
} as const

interface Context {}

const initialContext = (): Context => {
  const context: Context = {}
  return JSON.parse(JSON.stringify(context))
}

const ID = 'FileBoxToTextMachine'

/**
 * @request
 *  - events.FILE_BOX
 *
 * @response
 *  success: events.TEXT
 *  failure: events.GERROR
 */
const machine = createMachine<Context, Event>({
  id: ID,
  initial: states.idle,
  states: {
    [states.idle]: {
      entry: [
        Mailbox.actions.idle(ID)('idle'),
      ],
      on: {
        [types.FILE_BOX]: states.recognizing,
      },
    },
    [states.recognizing]: {
      entry: [
        actions.log((_, e) => `states.recognizing.entry fileBox: "${JSON.parse((e as Events['FILE_BOX']).payload.fileBox).name}"`, ID),
      ],
      invoke: {
        src: (_, e) => speechToText(FileBox.fromJSON(
          (e as Events['FILE_BOX']).payload.fileBox,
        )),
        onDone: {
          actions: [
            actions.log((_, e) => `states.recognizing.invoke.onDone "${e.data}"`, ID),
            actions.send((_, e) => events.TEXT(e.data)),
          ],
        },
        onError: {
          actions: [
            actions.log((_, e) => `states.recognizing.invoke.onError "${e.data}"`, ID),
            actions.send((_, e) => events.GERROR(GError.stringify(e.data))),
          ],
        },
      },
      on: {
        [types.TEXT]: states.responding,
        [types.GERROR]: states.responding,
      },
    },
    [states.responding]: {
      entry: [
        actions.log((_, e) => `states.responding.entry "${JSON.stringify(e)}"`, ID),
        Mailbox.actions.reply((_, e) => e),
      ],
      always: states.idle,
    },
  },
})

export {
  ID,
  types,
  events,
  states,
  machine,
  type Event,
  type Events,
  type Context,
  initialContext,
}
