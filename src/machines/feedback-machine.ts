/* eslint-disable sort-keys */
import {
  actions,
  assign,
  createMachine,
}                       from 'xstate'

import {
  type Message,
  type Contact,
  type Room,
  types as WechatyTypes,
}                       from 'wechaty'

import { stt } from '../stt.js'

import type * as events from './events.js'
import * as types       from './types.js'
import * as states      from './states.js'

/**
 *
 * Huan(202112): The Actor Model here need to be improved.
 *  @see https://github.com/wechaty/bot5-assistant/issues/4
 *
 */
type Task = {
  origin?: string
  message: Message
}

type Context = {
  currentTask : null | Task
  tasks       : Task[]
  // -------
  attendees   : Contact[]
  feedback    : null | string
  feedbacks   : { [id: string]: string }
  message     : null | Message,
  room        : null | Room,
}

/**
 * Huan(202112): The Typestate feature is for state.matches(...),
 *    and not yet for within the state machine.
 *    That's something we're going to work on for V5.
 *  @see https://github.com/statelyai/xstate/issues/1138#issuecomment-615435171
 */
type Typestate =
  | {
    value: typeof states.feedbacked,
    context: Context & {
      feedback: string,
      message: Message,
    },
  }
  | {
    value: typeof states.listening,
    context: Context & {
      feedback: null,
      message: null,
    },
  }
  | {
    value: typeof states.feedbacking,
    context: Context & {
      feedback: null,
      message: Message,
    },
  }

type Event =
  | ReturnType<typeof events.MESSAGE>
  | ReturnType<typeof events.ATTENDEES>
  | ReturnType<typeof events.ROOM>
  | ReturnType<typeof events.START>

const isText  = (message?: Message) => !!(message) && message.type() === WechatyTypes.Message.Text
const isAudio = (message?: Message) => !!(message) && message.type() === WechatyTypes.Message.Audio

const nextAttendee = (ctx: Context) => ctx.attendees.filter(c => !Object.keys(ctx.feedbacks).includes(c.id))[0]

const feedbackMachine = createMachine<Context, Event, Typestate>(
  {
    context: {
      currentTask : null,
      tasks       : [],
      // -------
      attendees   : [],
      feedback    : null,
      feedbacks   : {},
      message     : null,
      room        : null,
    },
    initial: 'idle',
    states: {
      [states.idle]: {
        on: {
          [types.ATTENDEES]: {
            actions: assign({
              attendees: (_, e)  => e.payload.attendees,
            }),
          },
          [types.ROOM]: {
            actions: assign({
              room: (_, e) => e.payload.room,
            }),
          },
          [types.START]: {
            target: 'checking',
          },
        },
      },
      checking: {
        always: [
          {
            cond: ctx => Object.keys(ctx.feedbacks).length >= ctx.attendees.length,
            target: 'done',
          },
          {
            cond: ctx => !!(ctx.room && ctx.attendees.length),
            target: 'listening',
          },
          {
            actions: actions.escalate('[feedback] checking: no room or attendees'),
            target: 'done',
          },
        ],
      },
      [states.listening]: {
        on: {
          [types.MESSAGE]: {
            actions: [
              assign({
                message:  (_, e) => e.payload.message,
              }),
            ],
            target: 'feedbacking',
          },
        },
      },
      [states.feedbacking]: {
        always: [
          {
            cond: ctx => isText(ctx.message!),
            actions: [
              assign({
                feedback: ctx => ctx.message!.text(),
              }),
            ],
            target: 'feedbacked',
          },
          {
            target: 'stt',
            cond: ctx => isAudio(ctx.message!),
          },
          {
            target: 'listening',
            actions: [actions.log('[feedback] feedbacking: no text or audio')],
          },
        ],
      },
      stt: {
        invoke: {
          src: async ctx => ctx.message && stt(await ctx.message.toFileBox()),
          onDone: {
            target: 'feedbacked',
            actions: [
              assign({
                feedback: (_, e) => e.data ?? 'NO STT RESULT',
              }),
            ],
          },
          onError: {
            target: 'listening',
            actions: actions.log('[feedback] stt error'),
          },
        },
      },
      [states.feedbacked]: {
        entry: [
          actions.log((ctx, _) => `[feedback] ${ctx.message!.talker()} feedback: ${ctx.feedback}`),
          actions.log((ctx, _) => `[feedback] next: ${nextAttendee(ctx)}`),
          assign({
            feedbacks: ctx => ({
              ...ctx.feedbacks,
              [ctx.message!.talker().id]: ctx.feedback || 'NO feedback',
            }),
          }),
        ],
        always: 'checking',
      },
      done: {
        entry: [
          actions.log('[feedback] done'),
        ],
        type: 'final',
        data: ctx => ctx.feedbacks,
      },
    },
  },
  {
    actions: {},
    services: {},
  },
)

export {
  feedbackMachine,
}
