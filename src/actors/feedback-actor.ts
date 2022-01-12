/* eslint-disable sort-keys */
import {
  actions,
  createMachine,
}                       from 'xstate'

import type {
  Message,
  Contact,
}                       from 'wechaty'
import { GError } from 'gerror'

import {
  Events as Bot5Events,
  States,
  Types,
}                   from '../schemas/mod.js'
import * as Mailbox from '../mailbox/mod.js'
import { messageToText }  from '../to-text/mod.js'
import { InjectionToken } from '../ioc/tokens.js'

import * as actors  from './mod.js'

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
  REPORT   : Bot5Events.REPORT,
} as const

type Event = ReturnType<typeof Events[keyof typeof Events]>

// const isText  = (message?: Message) => !!(message) && message.type() === WechatyTypes.Message.Text
// const isAudio = (message?: Message) => !!(message) && message.type() === WechatyTypes.Message.Audio

const nextContact = (ctx: Context) => ctx.contacts.filter(c =>
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
  registerAddress: Mailbox.Address,
  logger: Mailbox.Options['logger'],
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
    on: {
      [Types.CONTACTS]: {
        actions: [
          actions.assign({
            contacts: (_, e) => e.payload.contacts,
          }),
        ],
      },
    },
    states: {
      [States.initializing]: {
        always: States.idle,
      },
      [States.idle]: {
        entry: [
          Mailbox.Actions.idle(MACHINE_NAME)('idle'),
        ],
        on: {
          /**
           * Huan(202112):
           *  Every EVENTs received in state.idle must have a `target` to make sure it is a `external` event.
           *  so that the Mailbox.Actions.idle() will be triggered and let the Mailbox knowns it's ready to process next message.
           */
          '*': States.idle,
          [Types.CONTACTS]: {
            actions: [
              actions.assign({
                contacts: (_, e) => e.payload.contacts,
              }),
            ],
          },
          [Types.REPORT]: {
            actions: [
              actions.log('states.idle.on.REPORT', MACHINE_NAME),
            ],
            target: States.checking,
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
        entry: [
          actions.log('states.recognizing.entry', MACHINE_NAME),
          actions.assign({ feedback: _ => undefined }),
        ],
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
          actions.assign({
            feedbacks: ctx => ({
              ...ctx.feedbacks,
              [ctx.message!.talker().id]: ctx.feedback!,
            }),
          }),
        ],
        always: [
          {
            cond: ctx => !!ctx.feedback,
            actions: [
              actions.log(ctx => `states.recognized.always exist feedback: "${ctx.feedback}" from ${ctx.message!.talker().id}`, MACHINE_NAME),
              wechatyAddress.send(ctx => {
                // console.info('ctx', ctx)
                return actors.wechaty.Events.SAY(
                  `
                    收到${ctx.message!.talker().name()}的反馈：
                      ${ctx.feedback}

                    下一位：@${nextContact(ctx)?.name()}
                  `,
                  ctx.message!.room()!.id,
                  nextContact(ctx)?.id ? [nextContact(ctx)!.id] : [],
                )
              }),
            ],
            target: States.checking,
          },
          {
            target: States.idle,
          }
        ],
      },
      [States.registering]: {
        entry: [
          actions.log('states.registering.entry', MACHINE_NAME),
          registerAddress.send(Events.REPORT),
        ],
        on: {
          [Types.MESSAGE]: {
            actions: [
              registerAddress.send((_, e) => e),
            ],
          },
          [Types.CONTACTS]: {
            actions: [
              actions.assign({
                contacts: (_, e) => e.payload.contacts,
              }),
            ],
            target: States.checking,
          },
        },
      },
      [States.checking]: {
        entry: actions.log('states.checking.entry', MACHINE_NAME),
        always: [
          {
            cond: ctx => ctx.contacts.length <= 0,
            actions:[
              actions.log('states.checking.always no contacts', MACHINE_NAME),
            ],
            target: States.registering,
          },
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
  InjectionToken.RegisterMailbox,
  InjectionToken.Logger,
] as const
function mailboxFactory (
  wechatyMailbox: Mailbox.Interface,
  registerMailbox: Mailbox.Interface,
  logger: Mailbox.Options['logger'],
) {
  const machine = machineFactory(
    wechatyMailbox.address,
    registerMailbox.address,
    logger
  )
  const mailbox = Mailbox.from(machine, { logger })

  mailbox.acquire()
  return mailbox
}

export {
  machineFactory,
  mailboxFactory,
  Events,
  initialContext,
  nextContact,
}
