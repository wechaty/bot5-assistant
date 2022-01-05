/* eslint-disable sort-keys */
import {
  actions,
  createMachine,
}                       from 'xstate'

import type {
  Message,
  Contact,
  Wechaty,
  // Room,
}                       from 'wechaty'
import { GError } from 'gerror'
import type { Logger } from 'brolog'

import {
  Events as Bot5Events,
  States,
  Types,
}                   from '../schemas/mod.js'
import * as Mailbox from '../mailbox/mod.js'

import { messageToText }  from '../to-text/mod.js'
import { InjectionToken } from '../ioc/tokens.js'

type Context = {
  admins    : Contact[]
  //
  contacts  : Contact[]
  // room?      : Room,
  //
  message?   : Message,
  feedback?  : string
  feedbacks : { [id: string]: string }
  //
  gerror?    : string,
}

const Events = {
  ADMINS   : Bot5Events.ADMINS,
  CONTACTS : Bot5Events.CONTACTS,
  MESSAGE  : Bot5Events.MESSAGE,
  RESET    : Bot5Events.RESET,
} as const

type Event = ReturnType<typeof Events[keyof typeof Events]>

// const isText  = (message?: Message) => !!(message) && message.type() === WechatyTypes.Message.Text
// const isAudio = (message?: Message) => !!(message) && message.type() === WechatyTypes.Message.Audio

const nextAttendee = (ctx: Context) =>
  ctx.contacts.filter(c =>
    !Object.keys(ctx.feedbacks).includes(c.id),
  )[0]

function initialContext (): Context {
  const context: Context = {
    admins    : [],
    //
    contacts  : [],
    // room      : undefined,
    //
    message   : undefined,
    feedback  : undefined,
    feedbacks : {},
    //
    gerror     : undefined,
  }
  return JSON.parse(JSON.stringify(context))
}

const MACHINE_NAME = 'FeedbackMachine'

function machineFactory (
  wechatyAddress: Mailbox.Address,
  log: Logger,
) {
  const machine = createMachine<Context, Event>({
    id: MACHINE_NAME,
    context: initialContext(),
    /**
     * Issue statelyai/xstate#2891:
     *  The context provided to the expr inside a State
     *  should be exactly the **context in this state**
     * @see https://github.com/statelyai/xstate/issues/2891
     */
    preserveActionOrder: true,
    initial: States.initializing,
    states: {
      [States.initializing]: {
        always: States.idle,
      },
      [States.idle]: {
        entry: [
          Mailbox.Actions.idle(MACHINE_NAME),
        ],
        on: {
          /**
           * Huan(202112):
           *  Every EVENTs received in state.idle must have a `target` to make sure it is a `external` event.
           *  so that the Mailbox.Actions.idle() will be triggered and let the Mailbox knowns it's ready to process next message.
           */
          '*': States.idle,
          //
          [Types.CONTACTS]: {
            actions: [
              actions.log('states.idle.on.CONTACTS', MACHINE_NAME),
              actions.assign({
                contacts: (ctx, e)  => [
                  ...ctx.contacts,
                  ...e.payload.contacts,
                ],
              }),
            ],
            target: States.idle,
          },
          // [Types.ROOM]: {
          //   actions: [
          //     actions.log('states.idle.on.ROOM', MACHINE_NAME),
          //     actions.assign({
          //       room: (_, e) => e.payload.room,
          //     }),
          //   ],
          //   target: States.idle,
          // },
          [Types.ADMINS]: {
            actions: [
              actions.log('states.idle.on.ADMINS', MACHINE_NAME),
              actions.assign({
                admins: (ctx, e) => [
                  ...ctx.admins,
                  ...e.payload.contacts,
                ],
              }),
            ],
            target: States.idle,
          },
          [Types.RESET]: {
            actions: [
              actions.log('states.idle.on.RESET', MACHINE_NAME),
              actions.assign(_ => initialContext()),
            ],
            target: States.initializing,
          },
          [Types.MESSAGE]: {
            actions: [
              actions.log('states.idle.on.MESSAGE', MACHINE_NAME),
              actions.assign({
                message: (_, e) => e.payload.message,
              }),
            ],
            target: States.recognizing,
          },
        },
      },
      [States.erroring]: {
        entry: [
          actions.log('states.error.entry', MACHINE_NAME),
          Mailbox.Actions.reply(ctx => Bot5Events.ERROR(ctx.gerror!)),
        ],
        exit: [
          actions.assign({ gerror: _ => undefined }),
        ],
        always: States.idle,
      },
      [States.recognizing]: {
        entry: actions.log('states.recognizing.entry', MACHINE_NAME),
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
              actions.assign({
                gerror: (_, e) => GError.stringify(e.data),
                feedback: _ => undefined,
              }),
              actions.log((_, e) => 'states.recognizing invoke error: ' + e.data, MACHINE_NAME),
            ],
            target: States.erroring,
          },
        },
      },
      [States.recognized]: {
        entry: [
          actions.log(ctx => `states.recognized.entry current feedback from ${ctx.message!.talker()} feedback: "${ctx.feedback}"`, MACHINE_NAME),
          actions.log(ctx => `states.recognized.entry next feedbacker ${nextAttendee(ctx)}`, MACHINE_NAME),
        ],
        always: [
          {
            cond: ctx => !!ctx.feedback,
            actions: [
              actions.log(ctx => `states.recognized.always exist feedback: "${ctx.feedback}" from ${ctx.message!.talker().id}`, MACHINE_NAME),
              actions.assign({
                feedbacks: ctx => ({
                  ...ctx.feedbacks,
                  [ctx.message!.talker().id]: ctx.feedback!,
                }),
              }),
            ],
            target: States.checking,
          },
          {
            target: States.idle,
          }
        ],
      },
      [States.checking]: {
        entry: actions.log('states.checking.entry', MACHINE_NAME),
        always: [
          { // everyone feedback-ed
            cond: ctx => Object.keys(ctx.feedbacks).length >= ctx.contacts.length,
            actions: actions.log(ctx => `states.checking.always contacts.length=${ctx.contacts.length} feedbacks.length=${Object.keys(ctx.feedbacks).length}`, MACHINE_NAME),
            target: States.feedbacked,
          },
          {
            target: States.idle,
            actions: actions.log(ctx => `states.checking.always default contacts.length=${ctx.contacts.length} feedbacks.length=${Object.keys(ctx.feedbacks).length}`, MACHINE_NAME),
          },
        ],
      },
      [States.feedbacked]: {
        entry: [
          actions.log('states.feedbacked.entry', MACHINE_NAME),
          Mailbox.Actions.reply(ctx => Bot5Events.FEEDBACK(ctx.feedbacks)),
        ],
        always: States.idle,
      },
    },
  })
  return machine
}

mailboxFactory.inject = [
  InjectionToken.WechatyMailbox,
  InjectionToken.Logger,
] as const
function mailboxFactory (
  wechatyMailbox: Mailbox.Mailbox,
  log: Logger,
) {
  const machine = machineFactory(wechatyMailbox.address, log)
  const mailbox = Mailbox.from(machine)

  mailbox.acquire()
  return mailbox
}

export {
  machineFactory,
  mailboxFactory,
  Events,
  initialContext,
}
