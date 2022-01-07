/* eslint-disable sort-keys */
import {
  createMachine,
  actions,
}                 from 'xstate'
import type {
  Message,
  Contact,
}                 from 'wechaty'
import { GError } from 'gerror'

import * as Mailbox from '../mailbox/mod.js'
import {
  Events as Bot5Events,
  States,
  Types,
}                   from '../schemas/mod.js'
import { InjectionToken } from '../ioc/tokens.js'
import * as actors from './mod.js'

interface Context {
  message?: Message
  contacts: Contact[]
  chairs:   Contact[]
  gerror?:  string
  addresses: {
    wechaty?: string
  }
}

const Events = {
  MENTIONS   : Bot5Events.MENTIONS,
  MESSAGE    : Bot5Events.MESSAGE,
  NO_MENTION : Bot5Events.NO_MENTION,
  RESET      : Bot5Events.RESET,
  START      : Bot5Events.START,
} as const

type Event = ReturnType<typeof Events[keyof typeof Events]>

function initialContext (): Context {
  const context: Context = {
    message  : undefined,
    contacts : [],
    chairs   : [],
    gerror   : undefined,
    addresses: {},
  }
  return JSON.parse(JSON.stringify(context))
}
const MACHINE_NAME = 'RegisterMachine'

const machineFactory = (
  wechatyAddress: Mailbox.Address,
  logger: Mailbox.MailboxOptions['logger'],
) => createMachine<Context, Event>({
  id: MACHINE_NAME,
  initial: States.initializing,
  context: () => initialContext(),
  /**
   * Issue statelyai/xstate#2891:
   *  The context provided to the expr inside a State
   *  should be exactly the **context in this state**
   * @see https://github.com/statelyai/xstate/issues/2891
   */
  preserveActionOrder: true,
  states: {
    [States.initializing]: {
      always: States.idle,
    },
    [States.idle]: {
      entry: [
        Mailbox.Actions.idle(MACHINE_NAME)('idle'),
        actions.choose([
          {
            cond: ctx => !!ctx.addresses.wechaty && !!ctx.message?.room(),
            actions: actions.send(
              ctx => actors.wechaty.Events.SAY(
                'Register all members by mention them in one messsage.',
                ctx.message!.room()!.id,
                ctx.chairs.map(c => c.id),
              ),
              {
                to: ctx => ctx.addresses.wechaty!,
              },
            ),
          },
        ])
      ],
      on: {
        [Types.MESSAGE]: {
          actions: actions.choose<Context, ReturnType<typeof Events.MESSAGE>>([
            {
              cond: (_, e) => e.payload.message.self(),
              actions: actions.log((_, e) => `states.idle.on.message skip self messsage ${e.payload.message}`, MACHINE_NAME),
            },
            {
              cond: (_, e) => !e.payload.message.room(),
              actions: actions.log((_, e) => `states.idle.on.message skip non-room message ${e.payload.message}`, MACHINE_NAME),
            },
            {
              actions: [
                actions.assign({ message:  (_, e) => e.payload.message }),
                actions.log((_, e) => 'states.idle.on.message received ' + `"${e.payload.message}"`, MACHINE_NAME),
              ],
            },
          ]),
          target: States.checking,
        },
        [Types.RESET]: {
          actions: actions.assign({ contacts: _ => [] }),
          target: States.initializing,
        },
      },
    },
    [States.checking]: {
      entry: [
        actions.log('states.checking.entry', MACHINE_NAME),
      ],
      always: [
        {
          cond: ctx => !ctx.message,
          actions: actions.log('states.checking.always skip without message', MACHINE_NAME),
          target: States.idle,
        },
        {
          target: States.updating,
        },
      ],
    },
    [States.updating]: {
      entry: actions.log('states.updating.entry', MACHINE_NAME),
      invoke: {
        src: ctx => ctx.message!.mentionList(),
        onDone: {
          target: States.confirming,
          actions: actions.assign({
            contacts: (ctx, e)  => [
              ...ctx.contacts,
              ...e.data,
            ],
          }),
        },
        onError: {
          target: States.erroring,
          actions: actions.assign({ gerror: (_, e) => GError.stringify(e.data) }),
        },
      },
    },
    [States.confirming]: {
      entry: actions.log('states.confirming.entry', MACHINE_NAME),
      // TODO: ask 'do you need to edit the list?' with 60 seconds timeout with default N
      always: States.registered,
    },
    [States.erroring]: {
      entry: [
        actions.log(ctx => `states.erroring.entry ${ctx.gerror}`, MACHINE_NAME),
        Mailbox.Actions.reply(ctx => Bot5Events.ERROR(ctx.gerror!)),
      ],
      always: States.idle,
    },
    [States.registered]: {
      entry: [
        actions.log(ctx => `states.registered.entry contacts: "${ctx.contacts.map(c => c.name()).join(',')}"`, 'RegisterMachine'),
        Mailbox.Actions.reply(ctx => Bot5Events.CONTACTS(ctx.contacts)),
        actions.send(
          ctx => actors.wechaty.Events.SAY(
            `
              注册成功！
            `,
            ctx.message!.room()!.id,
            ctx.contacts.map(c => c.id),
          ),
          { to: String(wechatyAddress) },
        )
      ],
      always: States.idle,
    },
  },
})

mailboxFactory.inject = [
  InjectionToken.WechatyMailbox,
  InjectionToken.Logger,
] as const
function mailboxFactory (
  wechatyMailbox: Mailbox.Mailbox,
  logger: Mailbox.MailboxOptions['logger'],
) {
  const machine = machineFactory(wechatyMailbox.address, logger)
  const mailbox = Mailbox.from(machine, { logger })

  mailbox.acquire()
  return mailbox
}


export {
  machineFactory,
  mailboxFactory,
  initialContext,
  Events,
}
