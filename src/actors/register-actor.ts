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
  mentions: Contact[]
  contacts: Contact[]
  chairs:   Contact[]
  gerror?:  string
  addresses: {
    wechaty?: string
  }
}

const Events = {
  MESSAGE    : Bot5Events.MESSAGE,
  RESET      : Bot5Events.RESET,
  REPORT     : Bot5Events.REPORT,
} as const

type Event = ReturnType<typeof Events[keyof typeof Events]>

function initialContext (): Context {
  const context: Context = {
    message  : undefined,
    mentions: [],
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
  logger: Mailbox.Options['logger'],
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
            cond: ctx => !!ctx.message?.room(),
            actions: wechatyAddress.send(
              ctx => actors.wechaty.Events.SAY(
                'Register all members by mention them in one messsage.',
                ctx.message!.room()!.id,
                ctx.chairs.map(c => c.id),
              ),
            ),
          },
        ])
      ],
      on: {
        [Types.MESSAGE]: {
          actions: [
            actions.assign({ message: (_, e) => e.payload.message }),
          ],
          target: States.mentioning,
        },
        [Types.REPORT]: {
          actions: [
            actions.log('states.idle.on.REPORT', MACHINE_NAME),
            actions.choose([
              {
                cond: ctx => ctx.contacts.length > 0,
                actions: Mailbox.Actions.reply(ctx => Bot5Events.CONTACTS(ctx.contacts)),
              },
            ]),
          ],
          target: States.idle,
        },
        [Types.RESET]: {
          actions: actions.assign({ contacts: _ => [] }),
          target: States.initializing,
        },
      },
    },
    [States.mentioning]: {
      entry: [
        actions.log('states.mentioning.entry', MACHINE_NAME),
      ],
      invoke: {
        src: async ctx => {
          if (!ctx.message) {
            return []
          }
          // if (ctx.message.self()) {
          //   return []
          // }
          return ctx.message.mentionList()
        },
        onDone: {
          actions: [
            actions.assign({ mentions: (_, e) => e.data }),
          ],
          target: States.updating,
        },
        onError: {
          actions: actions.assign({ gerror: (_, e) => GError.stringify(e.data) }),
          target: States.idle,
        },
      },
    },
    [States.updating]: {
      entry: actions.log('states.updating.entry', MACHINE_NAME),
      exit: actions.assign({
        mentions: _ => [],
      }),
      always: [
        {
          cond: ctx => ctx.mentions.length > 0,
          actions: [
            actions.assign({
              contacts: ctx => [
                ...ctx.contacts,
                ...ctx.mentions.filter(m => !ctx.contacts.includes(m)),
              ],
            }),
          ],
          target: States.confirming,
        },
        {
          target: States.idle,
        },
      ],
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
              系统【注册】恭喜 ${ctx.contacts.map(c => c.name()).join('，')} 注册成功！
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
  wechatyMailbox: Mailbox.Interface,
  logger: Mailbox.Options['logger'],
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
