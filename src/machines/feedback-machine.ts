/* eslint-disable sort-keys */
import {
  actions,
  createMachine,
}                       from 'xstate'

import {
  type Message,
  type Contact,
  type Room,
  types as WechatyTypes,
}                       from 'wechaty'

import { stt } from '../stt.js'

import * as events from './events.js'
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
    value: typeof states.idle,
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
  | ReturnType<typeof events.STOP>
  | ReturnType<typeof events.ABORT>
  | ReturnType<typeof events.RESET>
  | ReturnType<typeof events.WAKEUP>

const isText  = (message?: Message) => !!(message) && message.type() === WechatyTypes.Message.Text
const isAudio = (message?: Message) => !!(message) && message.type() === WechatyTypes.Message.Audio

const nextAttendee = (ctx: Context) => ctx.attendees.filter(c => !Object.keys(ctx.feedbacks).includes(c.id))[0]

const initialContext = {
  currentTask : null,
  tasks       : [],
  // -------
  attendees   : [],
  feedback    : null,
  feedbacks   : {},
  room        : null,
} as Context

const feedbackMachine = createMachine<Context, Event, Typestate>(
  {
    context: initialContext,
    initial: states.inactive,
    on: {
      [types.RESET]: {
        actions: ctx => {
          ctx.currentTask = null
          ctx.tasks       = []
          ctx.feedback    = null
          ctx.feedbacks   = {}
          ctx.room        = null
        },
        target: states.inactive,
      },
      [types.MESSAGE]: {
        actions: [
          actions.assign({
            tasks: (ctx, e, { _event }) => [
              ...ctx.tasks,
              {
                message: e.payload.message,
                origin:  _event.origin,
              },
            ],
          }),
          actions.send(events.WAKEUP()),
        ],
      },
      [types.ATTENDEES]: {
        actions: actions.assign({
          attendees: (_, e)  => e.payload.attendees,
        }),
      },
      [types.ROOM]: {
        actions: actions.assign({
          room: (_, e) => e.payload.room,
        }),
      },
    },
    states: {
      [states.inactive]: {
        on: {
          [types.START]: {
            target: states.validating,
          },
          // forbidden WAKEUP transition with `inactive` state
          [types.WAKEUP]: undefined,
        },
      },
      [states.validating]: {
        always: [
          {
            cond: ctx => !(ctx.room && ctx.attendees.length),
            target: states.aborted,
          },
          states.active,
        ],
      },
      [states.aborted]: {
        // FIXME: respond here will only work as expected with xstate@5
        entry: actions.respond(_ => events.ABORT('[feedback] aborted')),
        type: 'final',
      },
      [states.completed]: {
        type: 'final',
        data: (_, e) => (e as any).data,
      },
      [states.active]: {
        onDone: states.completed,
        on: {
          [types.STOP]: {
            target: states.inactive,
            actions: [
              actions.send(events.RESET()),
            ],
          },
        },
        initial: states.checking,
        states: {
          [states.idle]: {
            on: {
              [types.WAKEUP]: states.checking,
            },
          },
          [states.checking]: {
            always: [
              { // everyone feedback-ed
                cond: ctx => Object.keys(ctx.feedbacks).length >= ctx.attendees.length,
                target: states.finished,
              },
              { // new message in queue
                cond: ctx => ctx.tasks.length > 0,
                actions: actions.assign({
                  currentTask: ctx => ctx.tasks.shift()!,
                }),
                target: states.feedbacking,
              },
              states.idle,
            ],
          },
          [states.feedbacking]: {
            always: [
              {
                cond: ctx => isText(ctx.currentTask!.message),
                actions: [
                  actions.assign({
                    feedback: ctx => ctx.currentTask!.message.text(),
                  }),
                ],
                target: states.feedbacked,
              },
              {
                target: states.stt,
                cond: ctx => isAudio(ctx.currentTask!.message),
              },
              {
                target: states.idle,
                actions: [actions.log('[feedback] feedbacking: no text or audio')],
              },
            ],
          },
          [states.stt]: {
            invoke: {
              src: async ctx => {
                const fileBox = await ctx.currentTask!.message.toFileBox()
                const text = await stt(fileBox)
                // console.info('text:', text)
                return text
              },
              onDone: {
                target: states.feedbacked,
                actions: [
                  actions.assign({
                    feedback: (_, e) => e.data ?? 'NO STT RESULT',
                  }),
                ],
              },
              onError: {
                target: states.idle,
                actions: actions.log('[feedback] stt error'),
              },
            },
          },
          [states.feedbacked]: {
            entry: [
              actions.log((ctx, _) => `[feedback] ${ctx.currentTask!.message.talker()} feedback: ${ctx.feedback}`),
              actions.log((ctx, _) => `[feedback] next: ${nextAttendee(ctx)}`),
              actions.assign({
                feedbacks: ctx => ({
                  ...ctx.feedbacks,
                  [ctx.currentTask!.message.talker().id]: ctx.feedback || 'NO feedback',
                }),
              }),
            ],
            always: states.checking,
          },
          [states.finished]: {
            type: 'final',
            entry: [
              actions.log('[feedback] finished'),
              // actions.send(ctx => events.FINISH(ctx.feedbacks)),
            ],
            data: ctx => ctx.feedbacks,
          },
        },
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
