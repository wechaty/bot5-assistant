/* eslint-disable sort-keys */
import {
  createMachine,
  actions,
}                   from 'xstate'

import type { Message } from 'wechaty'

import * as Mailbox from '../mailbox/mod.js'

import { stt } from '../to-text/mod.js'

import {
  Events,
  Types,
}             from '../schemas/mod.js'

type Event =
| ReturnType<typeof Events.MESSAGE>
| ReturnType<typeof Events.NO_AUDIO>
| ReturnType<typeof Events.TEXT>

interface Context {
  message: null | Message
}

const textMachine = createMachine<Context, Event>(
  {
    initial: 'idle',
    context: {
      message: null,
    },
    states: {
      idle: {
        entry: [
          actions.sendParent(Mailbox.Events.IDLE('stt idle')),
        ],
        on: {
          [Types.MESSAGE]: {
            actions: [
              actions.log((_, e) => 'stt idle on MESSAGE ' + JSON.stringify(e)),
              'saveMessage',
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
              actions.sendParent(Events.NO_AUDIO()),
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
                return Events.TEXT(e.data)
              }),
            ],
          },
          onError: {
            target: 'idle',
            actions: [
              actions.escalate((_, e) => Events.ERROR(e.data)),
            ],
          },
        },
      },
    },
  },
  {
    actions: {
      saveMessage: actions.assign({
        message:  (_, e) => (e as ReturnType<typeof Events.MESSAGE>).payload.message,
      }),
    },
    services: {
      stt: async context => context.message && stt(await context.message.toFileBox()),
    },
    guards: {
      isAudio:  ctx => !!ctx.message && ctx.message.type() === ctx.message.wechaty.Message.Type.Audio,
    },
  },
)

export {
  textMachine,
}
