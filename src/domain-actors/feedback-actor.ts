/* eslint-disable sort-keys */
import { actions, createMachine }   from 'xstate'
import type { Message, Contact }    from 'wechaty'
import { GError }                   from 'gerror'
import * as Mailbox                 from 'mailbox'

import { events, states, types }    from '../schemas/mod.js'
import { messageToText }            from '../to-text/mod.js'
import { InjectionToken }           from '../ioc/tokens.js'

import * as actors  from './mod.js'

type Context = {
  admins    : Contact[]
  contacts  : Contact[]
  message?  : Message,
  feedbacks : { [id: string]: string }
}

const Events = {
  ADMINS   : events.ADMINS,
  CONTACTS : events.CONTACTS,
  MESSAGE  : events.MESSAGE,
  RESET    : events.RESET,
  REPORT   : events.REPORT,
  FEEDBACK : events.FEEDBACK,
  GERROR   : events.GERROR,
  IDLE     : events.IDLE,
  PROCESS  : events.PROCESS,
} as const

type Event = ReturnType<typeof Events[keyof typeof Events]>

const ctxContactsNum   = (ctx: Context) => ctx.contacts.length
const ctxFeedbacksNum  = (ctx: Context) => Object.values(ctx.feedbacks).filter(Boolean).length
const ctxNextContact   = (ctx: Context) => ctx.contacts.filter(c =>
  !Object.keys(ctx.feedbacks).includes(c.id),
)[0]
const ctxContactAfterNext   = (ctx: Context) => ctx.contacts.filter(c =>
  !Object.keys(ctx.feedbacks).includes(c.id),
)[1]

function initialContext (): Context {
  const context: Context = {
    admins    : [],
    contacts  : [],
    message   : undefined,
    feedbacks : {},
  }
  return JSON.parse(JSON.stringify(context))
}

const MACHINE_NAME = 'FeedbackMachine'

function machineFactory (
  wechatyAddress: Mailbox.Address,
  registerAddress: Mailbox.Address,
  // logger: Mailbox.Options['logger'],
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
    initial: states.initializing,
    on: {
      [types.CONTACTS]: {
        actions: [
          actions.assign({
            contacts: (_, e) => e.payload.contacts,
          }),
        ],
      },
    },
    states: {
      [states.initializing]: {
        always: states.idle,
      },
      [states.idle]: {
        entry: [
          Mailbox.actions.idle(MACHINE_NAME)('idle'),
        ],
        on: {
          /**
           * Huan(202112):
           *  Every EVENTs received in state.idle must have a `target` to make sure it is a `external` event.
           *  so that the Mailbox.actions.idle() will be triggered and let the Mailbox knowns it's ready to process next message.
           */
          '*': states.idle,
          [types.CONTACTS]: {
            actions: [
              actions.assign({
                contacts: (_, e) => e.payload.contacts,
              }),
            ],
          },
          [types.REPORT]: {
            actions: [
              actions.log('states.idle.on.REPORT', MACHINE_NAME),
            ],
            target: states.processing,
          },
          [types.RESET]: {
            actions: [
              actions.log('states.idle.on.RESET', MACHINE_NAME),
              actions.assign(_ => initialContext()),
            ],
            target: states.initializing,
          },
          [types.MESSAGE]: {
            actions: [
              actions.log('states.idle.on.MESSAGE', MACHINE_NAME),
              actions.assign({
                message: (_, e) => e.payload.message,
              }),
            ],
            target: states.parsing,
          },
        },
      },
      [states.parsing]: {
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
              // console.info(e.data)
              return Events.GERROR(GError.stringify(e.data))
            }),
          },
        },
        on: {
          [types.FEEDBACK]: {
            actions: actions.log('states.parsing.on.FEEDBACK', MACHINE_NAME),
            target: states.feedbacking,
          },
          [types.GERROR]: {
            actions: [
              actions.log('states.parsing.on.GERROR', MACHINE_NAME),
              Mailbox.actions.reply((_, e) => events.GERROR((e as ReturnType<typeof Events.GERROR>).payload.gerror)),
            ],
            target: states.idle,
          },
        },
      },
      [states.feedbacking]: {
        entry: [
          actions.log((_, e) => `states.feedbacking.entry <- [FEEDBACK(${(e as ReturnType<typeof Events.FEEDBACK>).payload.contactId}, "${(e as ReturnType<typeof Events.FEEDBACK>).payload.feedback}")`, MACHINE_NAME),
          actions.assign({
            feedbacks: (ctx, e) => ({
              ...ctx.feedbacks,
              [(e as ReturnType<typeof Events.FEEDBACK>).payload.contactId]: (e as ReturnType<typeof Events.FEEDBACK>).payload.feedback,
            }),
          }),
          wechatyAddress.send((ctx, e) => actors.wechaty.events.SAY(
            [
              '【反馈系统】',
              `收到${ctx.message!.talker().name()}的反馈：`,
              `“${(e as ReturnType<typeof Events.FEEDBACK>).payload.feedback}”`,
            ].join(''),
            ctx.message!.room()!.id,
          )),
          actions.choose<Context, Event>([
            {
              cond: ctx => !!ctxNextContact(ctx),
              actions: [
                wechatyAddress.send(ctx => actors.wechaty.events.SAY(
                  [
                    '【反馈系统】',
                    `下一位：@${ctxNextContact(ctx)?.name()}`,
                    ctxContactAfterNext(ctx)?.name() ? `。（请@${ctxContactAfterNext(ctx)?.name()}做准备）` : '',
                  ].join(''),
                  ctx.message!.room()!.id,
                  !ctxContactAfterNext(ctx)
                    ? [ctxNextContact(ctx)!.id]
                    : [ctxNextContact(ctx)!.id, ctxContactAfterNext(ctx)!.id],
                )),
                actions.send(_ => Events.PROCESS()),
              ],
            },
            {
              actions: [
                wechatyAddress.send(ctx => actors.wechaty.events.SAY(
                  '【反馈系统】：已完成收集所有人反馈',
                  ctx.message!.room()!.id,
                )),
                actions.send(_ => Events.PROCESS()),
              ],
            },
          ]),
        ],
        on: {
          [types.PROCESS]:  states.processing,
          [types.IDLE]:     states.idle,
        },
      },
      [states.registering]: {
        entry: [
          actions.log('states.registering.entry', MACHINE_NAME),
          registerAddress.send(Events.REPORT),
        ],
        on: {
          [types.MESSAGE]: {
            actions: [
              registerAddress.send((_, e) => e),
            ],
          },
          [types.CONTACTS]: {
            actions: [
              actions.assign({
                contacts: (_, e) => e.payload.contacts,
              }),
            ],
            target: states.processing,
          },
        },
      },
      [states.processing]: {
        entry: actions.log('states.processing.entry', MACHINE_NAME),
        always: [
          {
            cond: ctx => ctxContactsNum(ctx) <= 0,
            actions:[
              actions.log('states.processing.always -> registering because no contacts', MACHINE_NAME),
            ],
            target: states.registering,
          },
          {
            target: states.reporting,
            actions: actions.log('states.processing.always -> reporting', MACHINE_NAME),
          },
        ],
      },
      [states.reporting]: {
        entry: [
          actions.log(ctx => `states.reporting.entry feedbacks/contacts(${ctxFeedbacksNum(ctx)}/${ctxContactsNum(ctx)})`, MACHINE_NAME),
          actions.choose<Context, any>([
            {
              cond: ctx => ctxContactsNum(ctx) <= 0,
              actions: [
                actions.log(_ => 'states.reporting.entry contacts is not set', MACHINE_NAME),
              ],
            },
            {
              cond: ctx => ctxFeedbacksNum(ctx) < ctxContactsNum(ctx),
              actions: [
                actions.log('states.reporting.entry feedbacks is not enough', MACHINE_NAME),
              ],
            },
            {
              actions: [
                actions.log('states.reporting.entry feedbacks reported', MACHINE_NAME),
                Mailbox.actions.reply(ctx => events.FEEDBACKS(ctx.feedbacks)),
              ],
            },
          ]),
        ],
        always: states.idle,
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
    // logger
  )
  const mailbox = Mailbox.from(machine, { logger })
  return mailbox
}

export {
  type Context,
  machineFactory,
  mailboxFactory,
  Events,
  initialContext,
  ctxNextContact,
}
