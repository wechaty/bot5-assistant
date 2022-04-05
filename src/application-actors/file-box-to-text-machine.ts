/* eslint-disable sort-keys */
import { createMachine, actions }   from 'xstate'
import * as Mailbox                 from 'mailbox'
import { GError }                   from 'gerror'
import { FileBox }                  from 'file-box'

import { speechToText }   from '../to-text/mod.js'
import * as schemas       from '../schemas/mod.js'

export const events = {
  FILE_BOX: schemas.events.FILE_BOX,
  GERROR: schemas.events.GERROR,
  TEXT: schemas.events.TEXT,
} as const

export type Event =
  | ReturnType<typeof events[keyof typeof events]>

export type Events = {
  [key in keyof typeof events]: ReturnType<typeof events[key]>
}

export const types = {
  FILE_BOX : schemas.types.FILE_BOX,
  GERROR   : schemas.types.GERROR,
  TEXT     : schemas.types.TEXT,
} as const

export const states = {
  idle        : schemas.states.idle,
  recognizing : schemas.states.recognizing,
  responding  : schemas.states.responding,
} as const

interface Context {}

export const initialContext = (): Context => {
  const context: Context = {}
  return JSON.parse(JSON.stringify(context))
}

const MACHINE_NAME = 'FileBoxToTextMachine'

/**
 * INPUT:
 *  - events.FILE_BOX
 *
 * OUTPUT:
 *  - events.TEXT
 */
export const machine = createMachine<Context, Event>({
  id: MACHINE_NAME,
  initial: states.idle,
  states: {
    [states.idle]: {
      entry: [
        Mailbox.actions.idle(MACHINE_NAME)('idle'),
      ],
      on: {
        [types.FILE_BOX]: states.recognizing,
      },
    },
    [states.recognizing]: {
      entry: [
        actions.log((_, e) => `states.recognizing.entry fileBox: "${JSON.parse((e as Events['FILE_BOX']).payload.fileBox).name}"`, MACHINE_NAME),
      ],
      invoke: {
        src: (_, e) => speechToText(FileBox.fromJSON(
          (e as Events['FILE_BOX']).payload.fileBox,
        )),
        onDone: {
          actions: [
            actions.log((_, e) => `states.recognizing.invoke.onDone "${e.data}"`, MACHINE_NAME),
            actions.send((_, e) => events.TEXT(e.data)),
          ],
        },
        onError: {
          actions: [
            actions.log((_, e) => `states.recognizing.invoke.onError "${e.data}"`, MACHINE_NAME),
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
        actions.log((_, e) => `states.responding.entry "${JSON.stringify(e)}"`, MACHINE_NAME),
        Mailbox.actions.reply((_, e) => e),
      ],
      always: states.idle,
    },
  },
})
