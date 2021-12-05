/* eslint-disable sort-keys */
import { createModel }  from 'xstate/lib/model.js'

import type { Message } from 'wechaty'

import { stt } from '../stt.js'
import {
  // ContextLastOrigin,
  respondLastOrigin,
}                       from './respond-last-origin.js'

const sttModel = createModel(
  {
    lastOrigin : undefined as undefined | string,
    message    : undefined as undefined | Message,
    text       : undefined as undefined | string,
  },
  {
    events: {
      MESSAGE  : (message: Message) => ({ message }),
      NO_AUDIO : ()                 => ({}),
      TEXT     : (text: string)     => ({ text }),
    },
  },
)

const sttMachine = sttModel.createMachine(
  {
    initial: 'idle',
    states: {
      idle: {
        on: {
          MESSAGE: {
            actions: 'saveMessage',
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
            actions: 'sendNoAudio',
            target: 'idle',
          },
        ],
      },
      recognizingAudio: {
        invoke: {
          src: 'stt',
          onDone: {
            target: 'recognized',
            actions: [
              'saveText',
            ],
          },
        },
      },
      recognized: {
        entry: 'sendText',
        always: 'idle',
        exit: 'clearAll',
      },
    },
  },
  {
    actions: {
      sendText    : respondLastOrigin(ctx => sttModel.events.TEXT(ctx.text || '')) as any,
      sendNoAudio : respondLastOrigin(sttModel.events.NO_AUDIO()) as any,
      //
      saveMessage: sttModel.assign({
        message:  (_, e) => e.message,
        lastOrigin: (_, __, { _event }) => _event.origin,
      }, 'MESSAGE') as any,
      saveText: sttModel.assign({
        text: (_, e)  => (e as any).data,
      }) as any,
      //
      clearAll: sttModel.assign({
        lastOrigin : undefined,
        message     : undefined,
        text        : undefined,
      }) as any,
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
  sttModel,
  sttMachine,
}
