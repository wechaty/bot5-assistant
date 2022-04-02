/* eslint-disable sort-keys */
import { createMachine, actions }   from 'xstate'
import type * as PUPPET             from 'wechaty-puppet'
import * as Mailbox                 from 'mailbox'

import { speechToText }   from '../to-text/mod.js'
import { events, types }  from '../schemas/mod.js'

type Event =
  | ReturnType<typeof events.message>
  | ReturnType<typeof events.noAudio>
  | ReturnType<typeof events.text>

interface Context {
  message?: PUPPET.payloads.Message
}

const textMachine = createMachine<Context, Event>(
  {
    initial: 'idle',
    context: {
      message: undefined,
    },
    states: {
      idle: {
        entry: [
          actions.sendParent(Mailbox.Events.CHILD_IDLE('stt idle')),
        ],
        on: {
          [types.MESSAGE]: {
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
              actions.sendParent(events.noAudio()),
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
                return events.text(e.data)
              }),
            ],
          },
          onError: {
            target: 'idle',
            actions: [
              actions.escalate((_, e) => events.gerror(e.data)),
            ],
          },
        },
      },
    },
  },
  {
    actions: {
      saveMessage: actions.assign({
        message:  (_, e) => (e as ReturnType<typeof events.message>).payload.message,
      }),
    },
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
