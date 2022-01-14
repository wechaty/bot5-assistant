/* eslint-disable sort-keys */
import {
  createMachine,
  actions,
}                 from 'xstate'
import type {
  Message,
  Contact,
}                 from 'wechaty'

import * as Mailbox from '../mailbox/mod.js'
import {
  Events as Bot5Events,
  EventPayloads,
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
}

const Events = {
  MESSAGE    : Bot5Events.MESSAGE,
  RESET      : Bot5Events.RESET,
  REPORT     : Bot5Events.REPORT,
  INTRODUCE  : Bot5Events.INTRODUCE,
  MENTION    : Bot5Events.MENTION,
  GERROR     : Bot5Events.GERROR,
  IDLE       : Bot5Events.IDLE,
} as const

type Event = ReturnType<typeof Events[keyof typeof Events]>

function initialContext (): Context {
  const context: Context = {
    message  : undefined,
    contacts : [],
    chairs   : [],
    gerror   : undefined,
  }
  return JSON.parse(JSON.stringify(context))
}

const ctxRoom   = (ctx: Context) => ctx.message!.room()!
const ctxContactsNum = (ctx: Context) => ctx.contacts.length

const MACHINE_NAME = 'RegisterMachine'

const machineFactory = (
  wechatyAddress: Mailbox.Address,
  // logger: Mailbox.Options['logger'],
) => createMachine<Context, Event>({
  id: MACHINE_NAME,
  initial: States.initializing,
  context: () => initialContext(),
  on: {
    [Types.RESET]: States.resetting,
    [Types.INTRODUCE]: {
      actions: [
        wechatyAddress.send(
          ctx => actors.wechaty.Events.SAY(
            [
              '【注册系统】说用说明书：',
              '请主席发送一条消息，同时一次性 @ 所有参会人员，即可完成参会活动人员注册。',
              `当前注册人数：${ctx.contacts.length}`,
            ].join(''),
            ctxRoom(ctx).id,
            ctx.chairs.map(c => c.id),
          ),
        ),
      ],
    },
  },
  preserveActionOrder: true,  // <- https://github.com/statelyai/xstate/issues/2891
  states: {
    [States.initializing]: {
      always: States.idle,
    },
    [States.idle]: {
      entry: [
        Mailbox.Actions.idle(MACHINE_NAME)('idle'),
      ],
      on: {
        '*': States.idle,
        [Types.MESSAGE]: {
          actions: [
            actions.log('states.idle.on.MESSAGE', MACHINE_NAME),
            actions.assign({ message: (_, e) => e.payload.message }),
          ],
          target: States.parsing,
        },
        [Types.REPORT]: {
          actions: [
            actions.log('states.idle.on.REPORT', MACHINE_NAME),
          ],
          target: States.reporting,
        },
      },
    },
    [States.reporting]: {
      entry: [
        actions.log(ctx => `states.reporting.entry contacts/${ctxContactsNum(ctx)}`, MACHINE_NAME),
        actions.choose<Context, any>([
          {
            cond: ctx => ctxContactsNum(ctx) > 0,
            actions: [
              actions.log(_ => 'states.reporting.entry -> [CONTACTS]', MACHINE_NAME),
              Mailbox.Actions.reply(ctx => Bot5Events.CONTACTS(ctx.contacts)),
            ],
          },
          {
            actions: [
              actions.log(_ => 'states.reporting.entry ctx.contacts is empty', MACHINE_NAME),
              actions.send(Events.INTRODUCE()),
            ],
          },
        ]),
      ],
      always: States.idle,
    },
    [States.resetting]: {
      entry: [
        actions.log('states.resetting.entry', MACHINE_NAME),
        actions.assign(_ => initialContext()),
      ],
      always: States.initializing,
    },
    [States.parsing]: {
      entry: [
        actions.log('states.parsing.entry', MACHINE_NAME),
      ],
      invoke: {
        src: async ctx => ctx.message ? ctx.message.mentionList() : [],
        onDone: {
          actions: actions.send((_, e) => Events.MENTION(e.data)),
        },
        onError: {
          actions: actions.send((_, e) => Events.GERROR(e.data)),
        }
      },
      on: {
        [Types.MENTION]: {
          actions: [
            actions.log((_, e) => `states.parsing.on.MENTION <- ${e.payload.contacts.map(c => c.name()).join(',')}`, MACHINE_NAME),
            actions.assign({
              contacts: (ctx, e) => [
                ...ctx.contacts,
                ...e.payload.contacts.filter(c => !ctx.contacts.includes(c)),
              ],
            }),
          ],
          target: States.confirming,
        },
        [Types.GERROR]: States.erroring,
      },
    },
    [States.confirming]: {
      entry: [
        actions.log(ctx => `states.confirming.entry contacts/${ctxContactsNum(ctx)}`, MACHINE_NAME),
        actions.choose<Context, any>([
          {
            cond: ctx => ctxContactsNum(ctx) > 0,
            actions: [
              wechatyAddress.send(ctx => actors.wechaty.Events.SAY(
                [
                  '【注册系统】',
                  `恭喜：${ctx.contacts.map(c => c.name()).join('、')}，共${ctx.contacts.length}名组织成员注册成功！`,
                ].join(''),
                ctxRoom(ctx).id,
                ctx.contacts.map(c => c.id),
              )),
              actions.send(Events.REPORT()),
            ],
          },
          {
            actions: [
              actions.send(Events.INTRODUCE()),
              actions.send(Events.IDLE()),
            ],
          },
        ]),
      ],
      on: {
        [Types.REPORT]: States.reporting,
        [Types.IDLE]:   States.idle,
      },
      // TODO: ask 'do you need to edit the list?' with 60 seconds timeout with default N
    },
    [States.erroring]: {
      entry: [
        actions.log((_, e) => `states.erroring.entry <- [GERROR(${(e as EventPayloads['GERROR']).payload.gerror})]`, MACHINE_NAME),
        Mailbox.Actions.reply((_, e) => e)
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
  const machine = machineFactory(wechatyMailbox.address)
  const mailbox = Mailbox.from(machine, { logger })

  mailbox.acquire()
  return mailbox
}


export {
  type Context,
  States,
  machineFactory,
  mailboxFactory,
  initialContext,
  Events,
}
