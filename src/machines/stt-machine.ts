/* eslint-disable sort-keys */
import {
  sendParent,
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
      MESSAGE : (message: Message) => ({ payload: { message } }),
      NO_TEXT : ()                 => ({}),
      TEXT    : (text: string)     => ({ payload: { text } }),
    },
  },
)

const sttMachine = sttModel.createMachine(
  {
    initial: 'idle',
    states: {
      idle: {
        exit: sttModel.assign({
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
      sendAudio  : sendParent((_, e)  => ({ type: 'TEXT', payload: { text: e.data } })),
      sendText   : sendParent(ctx     => ({ type: 'TEXT', payload: { text: ctx.text } })),
      sendNoText : sendParent('NO_TEXT'),
      // assign
      assignMessage:  sttModel.assign({ message:  (_, e)  => e.payload.message },   'MESSAGE') as any,
      assignAudio:    sttModel.assign({ text:     (_, e)  => (e as any).data },     'TEXT') as any,
      assignText:     sttModel.assign({ text:     (ctx)   => ctx.message?.text() }, 'TEXT') as any,
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
