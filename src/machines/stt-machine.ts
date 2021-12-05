/* eslint-disable sort-keys */
import {
  actions, ContextFrom,
}                       from 'xstate'
import { createModel }  from 'xstate/lib/model.js'

import type { Message } from 'wechaty'

import { stt } from '../stt.js'

const respond = (
  event: Parameters<typeof actions.send>[0],
) => actions.send(
  event,
  {
    to: (
      ctx: ContextFrom<typeof sttModel>,
    ) => ctx.eventOrigin!,
  },
)

const sttModel = createModel(
  {
    eventOrigin : undefined as undefined | string,
    message     : undefined as undefined | Message,
    text        : undefined as undefined | string,
  },
  {
    events: {
      MESSAGE   : (message: Message) => ({ message }),
      NOT_AUDIO : ()                 => ({}),
      TEXT      : (text: string)     => ({ text }),
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
            actions: 'sendNotAudio',
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
      sendText     : respond(ctx => sttModel.events.TEXT(ctx.text || '')) as any,
      sendNotAudio : respond(sttModel.events.NOT_AUDIO()) as any,
      //
      saveMessage: sttModel.assign({
        message:  (_, e) => e.message,
        eventOrigin: (_, __, { _event }) => _event.origin,
      }, 'MESSAGE') as any,
      saveText: sttModel.assign({
        text: (_, e)  => (e as any).data,
      }) as any,
      //
      clearAll: sttModel.assign({
        eventOrigin : undefined,
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
