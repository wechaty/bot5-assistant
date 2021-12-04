/* eslint-disable sort-keys */
import {
  sendParent,
  assign,
  actions,
}                   from 'xstate'
import { createModel } from 'xstate/lib/model.js'

import type { Message } from 'wechaty'

import { stt }      from '../stt.js'

const sttModel = createModel(
  {
    message : undefined as undefined | Message,
    text    : undefined as undefined | string,
  },
  {
    events: {
      MESSAGE : (message: Message) => ({ data: { message } }),
      NO_TEXT : ()                 => ({ data: undefined }),
      TEXT    : (text: string)     => ({ data: { text } }),
    },
  },
)

const sttMachine = sttModel.createMachine(
  {
    initial: 'idle',
    states: {
      idle: {
        entry: sttModel.assign({
          message: undefined,
          text: undefined,
        }),
        on: {
          MESSAGE: {
            actions: 'assignMessage',
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
            cond: 'isText',
            actions: [
              'assignText',
              actions.log(ctx => console.info('ctx:', ctx)),
              'sendText',
            ],
            target: 'idle',
          },
          {
            actions: 'sendNoText',
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
              'assignAudio',
              'sendAudio',
            ],
          },
        },
      },
    },
  },
  {
    actions: {
      // send
      sendAudio  : sendParent((_, e)  => ({ type: 'TEXT', data: { text: e.data } })),
      sendText   : sendParent(ctx     => {
        console.info('sendText ctx:', ctx)
        return ({ type: 'TEXT', data: { text: ctx.text } })
      }),
      sendNoText : sendParent('NO_TEXT'),
      // assign
      assignMessage:  sttModel.assign({ message:  (_, e) => e.data.message }, 'MESSAGE') as any,
      assignAudio:    sttModel.assign({ text:     (_, e) => (e as any).data }) as any,
      assignText:     sttModel.assign({ text:     (ctx) => ctx.message!.text() }, 'TEXT') as any,
    },
    services: {
      stt: async context => context.message && stt(await context.message.toFileBox()),
    },
    guards: {
      isText:   ctx => !!ctx.message && ctx.message.type() === ctx.message.wechaty.Message.Type.Text,
      isAudio:  ctx => !!ctx.message && ctx.message.type() === ctx.message.wechaty.Message.Type.Audio,
    },
  },
)

export {
  sttModel,
  sttMachine,
}
