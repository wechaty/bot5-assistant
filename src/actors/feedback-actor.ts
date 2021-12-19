/* eslint-disable sort-keys */
import {
  actions,
  createMachine,
}                       from 'xstate'

import type {
  Message,
  Contact,
  Room,
}                       from 'wechaty'

import {
  Events,
  States,
  Types,
}                   from '../schemas/mod.js'
import * as Mailbox from '../mailbox/mod.js'

import { messageToText }  from '../to-text/mod.js'

type Context = {
  admins    : Contact[]
  //
  contacts  : Contact[]
  room?      : Room,
  //
  message?   : Message,
  feedback?  : string
  feedbacks : { [id: string]: string }
}

type Event =
  | ReturnType<typeof Events.MESSAGE>
  | ReturnType<typeof Events.CONTACTS>
  | ReturnType<typeof Events.ROOM>
  | ReturnType<typeof Events.START>
  | ReturnType<typeof Events.STOP>
  | ReturnType<typeof Events.ABORT>
  | ReturnType<typeof Events.RESET>
  | ReturnType<typeof Events.ADMINS>

// const isText  = (message?: Message) => !!(message) && message.type() === WechatyTypes.Message.Text
// const isAudio = (message?: Message) => !!(message) && message.type() === WechatyTypes.Message.Audio

const nextAttendee = (ctx: Context) =>
  ctx.contacts.filter(c =>
    !Object.keys(ctx.feedbacks).includes(c.id),
  )[0]

const initialContext = () => {
  const context: Context = {
    admins    : [],
    //
    contacts  : [],
    room      : undefined,
    //
    message   : undefined,
    feedback  : undefined,
    feedbacks : {},
  }
  return JSON.parse(JSON.stringify(context)) as typeof context
}

const feedbackMachine = createMachine<Context, Event>(
  {
    context: initialContext(),
    initial: States.initializing,
    states: {
      [States.initializing]: {
        always: States.starting,
      },
      [States.starting]: {
        always: States.checking,
      },
      [States.checking]: {
        entry: actions.log('states.checking.entry', 'FeedbackMachine'),
        always: [
          { // everyone feedback-ed
            cond: ctx => ctx.contacts.length > 0 && Object.keys(ctx.feedbacks).length >= ctx.contacts.length,
            actions: actions.log(ctx => `states.checking.always contacts.length=${ctx.contacts.length} feedbacks.length=${Object.keys(ctx.feedbacks).length}`, 'FeedbackMachine'),
            target: States.feedbacked,
          },
          {
            target: States.idle,
            actions: actions.log(ctx => `states.checking.always default contacts.length=${ctx.contacts.length} feedbacks.length=${Object.keys(ctx.feedbacks).length}`, 'FeedbackMachine'),
          },
        ],
      },
      [States.idle]: {
        entry: [
          Mailbox.Actions.sendParentIdle('feedbackMachine'),
        ],
        on: {
          [Types.CONTACTS]: {
            actions: [
              actions.log('states.idle.on.CONTACTS', 'FeedbackMachine'),
              actions.assign({
                contacts: (ctx, e)  => [
                  ...ctx.contacts,
                  ...e.payload.contacts,
                ],
              }),
            ],
          },
          [Types.ROOM]: {
            actions: [
              actions.log('states.idle.on.ROOM', 'FeedbackMachine'),
              actions.assign({
                room: (_, e) => e.payload.room,
              }),
            ],
          },
          [Types.ADMINS]: {
            actions: [
              actions.log('states.idle.on.ADMINS', 'FeedbackMachine'),
              actions.assign({
                admins: (ctx, e) => [
                  ...ctx.admins,
                  ...e.payload.contacts,
                ],
              }),
            ],
          },
          [Types.RESET]: {
            actions: [
              actions.log('states.idle.on.RESET', 'FeedbackMachine'),
              actions.assign(_ => initialContext()),
            ],
            target: States.initializing,
          },
          [Types.MESSAGE]: {
            actions: [
              actions.log('states.idle.on.MESSAGE', 'FeedbackMachine'),
              actions.assign({
                message: (_, e) => e.payload.message,
              }),
            ],
            target: States.recognizing,
          },
        },
      },
      [States.recognizing]: {
        entry: actions.log('states.recognizing.entry', 'FeedbackMachine'),
        invoke: {
          src: (ctx) => messageToText(ctx.message),
          onDone: {
            actions: actions.assign({
              feedback: (_, e) => e.data,
            }),
            target: States.recognized,
          },
          onError: {
            actions: [
              actions.assign({ feedback: _ => undefined }),
              actions.log((_, e) => 'states.feedbacking invoke error: ' + e.data, 'FeedbackMachine'),
            ],
            target: States.unknown,
          },
        },
      },
      [States.unknown]: {
        entry: [
          actions.log('states.unknown.entry', 'FeedbackMachine'),
        ],
        always: States.checking,
      },
      [States.recognized]: {
        entry: [
          actions.log((ctx, _) => `states.recognized.entry current feedback from ${ctx.message!.talker()} feedback: "${ctx.feedback}"`, 'FeedbackMachine'),
          actions.log((ctx, _) => `states.recognized.entry next feedbacker ${nextAttendee(ctx)}`, 'FeedbackMachine'),
        ],
        always: [
          {
            cond: ctx => !ctx.feedback,
            target: States.unknown,
          },
          {
            actions: [
              actions.log(ctx => `states.recognized.always exist feedback: "${ctx.feedback}" from ${ctx.message!.talker().id}`, 'FeedbackMachine'),
              actions.assign({
                feedbacks: ctx => ({
                  ...ctx.feedbacks,
                  [ctx.message!.talker().id]: ctx.feedback!,
                }),
              }),
            ],
            target: States.checking,
          },
        ],
      },
      [States.feedbacked]: {
        entry: [
          actions.log('states.feedbacked', 'FeedbackMachine'),
          actions.sendParent(ctx => Events.FEEDBACK(ctx.feedbacks)),
        ],
        always: States.idle,
      },
    },
  },
)

const feedbackActor = Mailbox.address(feedbackMachine)

export {
  feedbackActor,
  feedbackMachine,
}
