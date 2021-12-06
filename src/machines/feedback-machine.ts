/* eslint-disable sort-keys */
import { actions } from 'xstate'
import { createModel }  from 'xstate/lib/model.js'

import {
  type Message,
  type Contact,
  type Room,
  types as TYPES,
}                       from 'wechaty'

import { stt } from '../stt.js'

import * as events from './events.js'

const isText  = (message?: Message) => !!(message) && message.type() === TYPES.Message.Text
const isAudio = (message?: Message) => !!(message) && message.type() === TYPES.Message.Audio

const nextAttendee = (attendees: Contact[], excludeIds: string[]) => attendees.filter(c => !excludeIds.includes(c.id))[0]

/**
 *
 * Huan(202112): The Actor Model here need to be improved.
 *  @see https://github.com/wechaty/bot5-assistant/issues/4
 *
 */
const feedbackModel = createModel(
  {
    message: undefined as undefined | Message,
    room: undefined as undefined | Room,
    attendees: [] as Contact[],
    feedback: undefined as undefined | string,
    feedbacks: {} as { [key: string]: string },
  },
  {
    events: {
      MESSAGE: events.payloads.MESSAGE,
      ROOM: events.payloads.ROOM,
      ATTENDEES: events.payloads.ATTENDEES,
      NEXT: events.payloads.NEXT,
    },
  },
)

const feedbackMachine = feedbackModel.createMachine(
  {
    initial: 'idle',
    states: {
      idle: {
        on: {
          ATTENDEES: {
            actions: feedbackModel.assign({
              attendees: (_, e)  => e.attendees,
            }),
          },
          ROOM: {
            actions: feedbackModel.assign({
              room: (_, e) => e.room,
            }),
            target: 'listening',
          },
          NEXT: {
            target: 'validating',
          },
        },
      },
      validating: {
        always: [
          {
            cond: ctx => !!(ctx.room && ctx.attendees),
            target: 'listening',
          },
          {
            actions: [actions.log('[feedback] validating: no room or attendees')],
            target: 'idle',
          },
        ],
      },
      listening: {
        on: {
          MESSAGE: {
            actions: feedbackModel.assign({
              message:  (_, e) => e.message,
            }),
            target: 'feedbacking',
          },
        },
      },
      feedbacking: {
        always: [
          {
            cond: ctx => isText(ctx.message),
            actions: feedbackModel.assign({
              feedback: ctx => ctx.message?.text(),
            }),
            target: 'feedbacked',
          },
          {
            target: 'stt',
            cond: ctx => isAudio(ctx.message),
          },
          {
            target: 'listening',
            actions: [],
          },
        ],
      },
      stt: {
        invoke: {
          src: async ctx => ctx.message && stt(await ctx.message.toFileBox()),
          onDone: {
            target: 'feedbacked',
            actions: feedbackModel.assign({
              feedback: (_, e) => (e as any).data,
            }),
          },
          onError: {
            target: 'listening',
            actions: actions.log('[feedback] stt error'),
          },
        },
      },
      feedbacked: {
        entry: [
          actions.log((ctx, _) => `[feedback] ${ctx.message!.talker()} feedback: ${ctx.feedback}`),
          actions.log((ctx, _) => `[feedback] next: ${nextAttendee(ctx.attendees, Object.keys(ctx.feedbacks))}`),
          feedbackModel.assign({
            feedbacks: ctx => ({
              ...ctx.feedbacks,
              [ctx.message!.talker().id]: ctx.feedback || 'NO feedback',
            }),
          }),
        ],
        always: [
          {
            cond: ctx => Object.keys(ctx.feedbacks).length < ctx.attendees.length,
            target: 'listening',
          },
          {
            target: 'done',
          },
        ],
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
  feedbackModel,
  feedbackMachine,
}
