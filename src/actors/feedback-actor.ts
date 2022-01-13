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
  contacts  : Contact[]
  message?  : Message,
  feedbacks : { [id: string]: string }
  gerror?   : string,
}

const Events = {
  ADMINS   : Bot5Events.ADMINS,
  CONTACTS : Bot5Events.CONTACTS,
  MESSAGE  : Bot5Events.MESSAGE,
  RESET    : Bot5Events.RESET,
  REPORT   : Bot5Events.REPORT,
  FEEDBACK : Bot5Events.FEEDBACK,
  GERROR   : Bot5Events.GERROR,
  IDLE: Bot5Events.IDLE,
  PROCESS: Bot5Events.PROCESS,
} as const

type Event = ReturnType<typeof Events[keyof typeof Events]>

const contactsNum   = (ctx: Context) => ctx.contacts.length
const feedbacksNum  = (ctx: Context) => Object.values(ctx.feedbacks).filter(Boolean).length
const nextContact   = (ctx: Context) => ctx.contacts.filter(c =>
  !Object.keys(ctx.feedbacks).includes(c.id),
)[0]

function initialContext (): Context {
  const context: Context = {
    admins    : [],
    contacts  : [],
    message   : undefined,
    feedbacks : {},
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
            target: States.processing,
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
            target: States.parsing,
          },
        },
      },
      [States.parsing]: {
        entry: [
          actions.log('states.parsing.entry', MACHINE_NAME),
        ],
        invoke: {
          src: (ctx) => messageToText(ctx.message),
          onDone: {
            actions: actions.send((ctx, e) =>
              Events.FEEDBACK(ctx.message!.talker().id, e.data),
            ),
          },
          onError: {
            actions: actions.send((_, e) => {
              console.info(e.data)
              return Events.GERROR(GError.stringify(e.data))
            }),
          },
        },
        on: {
          [Types.FEEDBACK]: {
            actions: actions.log('states.parsing.on.FEEDBACK', MACHINE_NAME),
            target: States.feedbacking,
          },
          [Types.GERROR]: {
            actions: [
              actions.log('states.parsing.on.GERROR', MACHINE_NAME),
              Mailbox.Actions.reply((_, e) => Bot5Events.GERROR((e as ReturnType<typeof Events.GERROR>).payload.gerror)),
            ],
            target: States.idle,
          },
        },
      },
      [States.feedbacking]: {
        entry: [
          actions.log((_, e) => `states.feedbacking.entry <- [FEEDBACK(${(e as ReturnType<typeof Events.FEEDBACK>).payload.contactId}, "${(e as ReturnType<typeof Events.FEEDBACK>).payload.feedback}")`, MACHINE_NAME),
          actions.assign({
            feedbacks: (ctx, e) => ({
              ...ctx.feedbacks,
              [(e as ReturnType<typeof Events.FEEDBACK>).payload.contactId]: (e as ReturnType<typeof Events.FEEDBACK>).payload.feedback,
            }),
          }),
          actions.choose<Context, Event>([
            {
              cond: (_, e) => !!(e as ReturnType<typeof Events.FEEDBACK>).payload.feedback,
              actions: [
                wechatyAddress.send((ctx, e) => {
                  // console.info('ctx', ctx)
                  return actors.wechaty.Events.SAY(
                    `
                      收到${ctx.message!.talker().name()}的反馈：
                        ${(e as ReturnType<typeof Events.FEEDBACK>).payload.feedback}

                      下一位：@${nextContact(ctx)?.name()}
                    `,
                    ctx.message!.room()!.id,
                    nextContact(ctx)?.id ? [nextContact(ctx)!.id] : [],
                  )
                }),
                actions.send(_ => Events.PROCESS()),
              ],
            },
            {
              actions: [
                actions.send(_ => Events.IDLE()),
              ],
            },
          ])
        ],
        on: {
          [Types.PROCESS]: States.processing,
          [Types.IDLE]:  States.idle,
        },
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
            target: States.processing,
          },
        },
      },
      [States.processing]: {
        entry: actions.log('states.processing.entry', MACHINE_NAME),
        always: [
          {
            cond: ctx => contactsNum(ctx) <= 0,
            actions:[
              actions.log('states.processing.always -> registering because no contacts', MACHINE_NAME),
            ],
            target: States.registering,
          },
          {
            target: States.reporting,
            actions: actions.log('states.processing.always -> reporting', MACHINE_NAME),
          },
        ],
      },
      [States.reporting]: {
        entry: [
          actions.log(ctx => `states.reporting.entry feedbacks/contacts(${feedbacksNum(ctx)}/${contactsNum(ctx)})`, MACHINE_NAME),
          actions.choose<Context, any>([
            {
              cond: ctx => contactsNum(ctx) <= 0,
              actions: [
                actions.log(_ => 'states.reporting.entry contacts is not set', MACHINE_NAME),
              ],
            },
            {
              cond: ctx => feedbacksNum(ctx) < contactsNum(ctx),
              actions: [
                actions.log('states.reporting.entry feedbacks is not enough', MACHINE_NAME),
              ],
            },
            {
              actions: [
                actions.log('states.reporting.entry feedbacks reported', MACHINE_NAME),
                Mailbox.Actions.reply(ctx => Bot5Events.FEEDBACKS(ctx.feedbacks)),
              ],
            },
          ]),
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
  type Context,
  machineFactory,
  mailboxFactory,
  Events,
  initialContext,
  nextContact,
}
