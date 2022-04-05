/* eslint-disable sort-keys */
import { createMachine, actions }   from 'xstate'
import type * as PUPPET             from 'wechaty-puppet'
import * as Mailbox                 from 'mailbox'

import { speechToText }   from '../to-text/mod.js'
import * as schemas       from '../schemas/mod.js'

const events = {
  MESSAGE: schemas.events.MESSAGE,
  GERROR: schemas.events.GERROR,
  NO_AUDIO: schemas.events.NO_AUDIO,
  TEXT: schemas.events.TEXT,
} as const

type Event =
  | ReturnType<typeof events[keyof typeof events]>

type Events = {
  [key in keyof typeof events]: ReturnType<typeof events[key]>
}

const types = {
  MESSAGE: schemas.types.MESSAGE,
} as const

interface Context {
  message?: PUPPET.payloads.Message
  address?: {
    wechaty: string
  }
}

const initialContext = (): Context => {
  const context: Context = {
    message : undefined,
    address : undefined,
  }
  return JSON.parse(JSON.stringify(context))
}

const MACHINE_NAME = 'TextMachine'

const textMachine = createMachine<Context, Event>(
  {
    initial: 'idle',
    context: initialContext,
    states: {
      idle: {
        entry: [
          Mailbox.actions.idle(MACHINE_NAME)('stt idle'),
        ],
        on: {
          [types.MESSAGE]: {
            actions: [
              actions.log((_, e) => `states.idle.on.MESSAGE ${JSON.stringify(e)}`, MACHINE_NAME),
              actions.assign({
                message:  (_, e) => (e as Events['MESSAGE']).payload.message,
              }),
            ],
            target: 'selecting',
          },
        },
      },
      selecting: {
        always: [
          {
            cond: 'isAudio',
            target: 'recognizingAudio',
          },
          {
            actions: [
              actions.log('states.selecting.always.text'),
              actions.sendParent(events.NO_AUDIO()),
            ],
            target: 'idle',
          },
        ],
      },
      recognizingAudio: {
        invoke: {
          src: 'stt',
          onDone: {
            target: 'idle',
            actions: [
              actions.sendParent((_, e) => {
                // console.info('stt result', e.data)
                return events.TEXT(e.data)
              }),
            ],
          },
          onError: {
            target: 'idle',
            actions: [
              actions.escalate((_, e) => events.GERROR(e.data)),
            ],
          },
        },
      },
    },
  },
  {
    services: {
      stt: async context => context.message && speechToText(await context.message.toFileBox()),
    },
    guards: {
      isAudio:  ctx => !!ctx.message && ctx.message.type() === ctx.message.wechaty.Message.Type.Audio,
    },
  },
)

export {
  textMachine,
}
