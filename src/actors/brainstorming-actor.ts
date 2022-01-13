/* eslint-disable sort-keys */
import {
  actions,
  createMachine,
}                   from 'xstate'

import type {
  Message,
  Contact,
  Room,
}             from 'wechaty'

import {
  Events as Bot5Events,
  States,
  Types,
}                 from '../schemas/mod.js'

import * as Mailbox  from '../mailbox/mod.js'
import * as actors        from './mod.js'

import { InjectionToken } from '../ioc/mod.js'

interface Context {
  chairs   : Contact[],
  room?    : Room,
  contacts : Contact[],
  gerror?   : string,
  feedbacks: {
    [id: string]: string,
  },
  notices: string[],
}

const Events = {
  CONTACTS  : Bot5Events.CONTACTS,
  FEEDBACKS : Bot5Events.FEEDBACKS,
  //
  INTRODUCE : Bot5Events.INTRODUCE,
  ROOM      : Bot5Events.ROOM,
  MESSAGE   : Bot5Events.MESSAGE,
  RESET     : Bot5Events.RESET,
  REPORT    : Bot5Events.REPORT,
  NOTICE    : Bot5Events.NOTICE,
  IDLE      : Bot5Events.IDLE,
  PROCESS   : Bot5Events.PROCESS,
} as const

type Event = ReturnType<typeof Events[keyof typeof Events]>

const ctxFeedbacksNum = (ctx: Context) => Object.values(ctx.feedbacks).filter(Boolean).length
const ctxContactsNum  = (ctx: Context) => ctx.contacts.length
const ctxNoticesNum   = (ctx: Context) => ctx.notices.length

const MACHINE_NAME = 'BrainstormingMachine'

function initialContext (): Context {
  const context: Context = {
    chairs    : [],
    room      : undefined,
    contacts : [],
    gerror: undefined,
    feedbacks: {},
    notices: [],
  }
  return JSON.parse(JSON.stringify(context))
}

function machineFactory (
  feedbackAddress : Mailbox.Address,
  registerAddress : Mailbox.Address,
  wechatyAddress  : Mailbox.Address,
  logger: Mailbox.Options['logger'],
) {
  void logger
  const machine = createMachine<Context, Event>({
    id: MACHINE_NAME,
    context: () => initialContext(),
    initial: States.initializing,
    on: {
      // '*': States.idle, // external transision is required by Mailbox Actor to work
      [Types.RESET]: States.resetting,
      [Types.NOTICE]: {
        actions: [
          actions.log((_, e) => `on.NOTICE ${e.payload.notice}`, MACHINE_NAME),
          actions.assign({
            notices: (ctx, e) => [
              ...ctx.notices,
              e.payload.notice,
            ],
          }),
        ],
      },
      [Types.INTRODUCE]: {
        actions: [
          actions.log('on.INTRODUCE', MACHINE_NAME),
          wechatyAddress.send(ctx => actors.wechaty.Events.SAY(
            `
              头脑风暴环节：每位参会者按照报名确认顺序，在 BOT Friday Club 微信群中，通过“按住说话”功能，把自己在活动中得到的新点子与大家分享。
              当前主席：${ctx.chairs.map(c => c.name()).join('，')}
              当前参会者：${ctx.contacts.map(c => c.name()).join('，')}
              已经完成头脑风暴的参会者：${Object.keys(ctx.feedbacks).map(c => ctx.feedbacks[c]).join('，')}
              还没有完成头脑风暴的参会者：${ctx.contacts.filter(c => !ctx.feedbacks[c.id]).map(c => c.name()).join('，')}
            `,
            ctx.room!.id,
            ctx.contacts.map(c => c.id),
          )),
        ],
      },
    },
    preserveActionOrder: true,
    states: {
      [States.initializing]: {
        entry: [
          actions.log('states.initializing.entry' , MACHINE_NAME),
        ],
        always: States.idle,
      },
      [States.resetting]: {
        entry: [
          actions.log('states.resetting.entry' , MACHINE_NAME),
          actions.assign(_ => initialContext()),
        ],
        always: States.initializing,
      },
      [States.idle]: {
        entry: [
          actions.log('states.idle.entry' , MACHINE_NAME),
          Mailbox.Actions.idle(MACHINE_NAME)('idle'),
        ],
        on: {
          [Types.REPORT]: {
            target: States.reporting,
          },
          [Types.ROOM]: {
            actions: actions.assign({ room: (_, e) => e.payload.room }),
            target: States.idle,
          },
        },
      },
      [States.reporting]: {
        entry: [
          actions.log(ctx => `states.reporting.entry feedbacks(${ctxFeedbacksNum(ctx)})` , MACHINE_NAME),
          actions.choose<Context, any>([
            {
              cond: ctx => ctxFeedbacksNum(ctx) > 0,
              actions: [
                actions.log(`states.reporting.entry -> [FEEDBACKS], [IDLE]` , MACHINE_NAME),
                Mailbox.Actions.reply(ctx => Events.FEEDBACKS(ctx.feedbacks)),
                actions.send(Events.IDLE()),
              ],
            },
            {
              actions: [
                actions.log(`states.reporting.entry -> [PROCESS]` , MACHINE_NAME),
                actions.send(Events.PROCESS()),
              ],
            }
          ]),
        ],
        on: {
          [Types.IDLE]:     States.idle,
          [Types.PROCESS]:  States.processing,
        },
      },
      [States.noticing]: {
        entry: [
          actions.log(ctx => `states.noticing.entry notices/${ctx.notices.length}`, MACHINE_NAME),
          actions.choose([
            {
              cond: ctx => ctxNoticesNum(ctx) > 0,
              actions: wechatyAddress.send(ctx => actors.wechaty.Events.SAY(
                `叮！系统检测到${ctx.notices.length}条新更新：
                ${
                  ctx.notices
                    .map((v, i) => `${i+1}. ${v}`)
                    .join('\n')
                }
                收获${ctx.notices.length}点经验值（可通过查看“我的经验值”查询）。
                `,
                ctx.room!.id,
                ctx.contacts.map(c => c.id),
              )),
            },
            {
              actions: actions.log('states.noticing.entry no notices', MACHINE_NAME),
            }
          ]),
        ],
        exit: [
          actions.assign({ notices: _ => [] }),
        ],
        always: States.processing,
      },
      [States.processing]: {
        entry: [
          actions.log('states.processing.entry', MACHINE_NAME),
        ],
        always: [
          {
            cond: ctx => ctxNoticesNum(ctx) > 0,
            target: States.noticing,
          },
          {
            cond: ctx => ctxContactsNum(ctx) <= 0,
            target: States.registering,
          },
          {
            cond: ctx => ctxFeedbacksNum(ctx) < ctxContactsNum(ctx),
            target: States.feedbacking,
          },
          {
            actions: [
              wechatyAddress.send(ctx => actors.wechaty.Events.SAY(
                `
                  叮！系统检测到您已经成功完成头脑风暴，恭喜宿主！
                `,
                ctx.room!.id,
                ctx.contacts.map(c => c.id),
              )),
            ],
            target: States.reporting,
          },
        ],
      },
      [States.registering]: {
        entry: [
          actions.log('states.registering.entry', MACHINE_NAME),
          registerAddress.send(actors.register.Events.REPORT()),
        ],
        on: {
          [Types.MESSAGE]: {
            actions: registerAddress.send((_, e) => e),
          },
          [Types.CONTACTS]: {
            actions: [
              actions.log((_, e) => `states.registering.on.CONTACTS ${e.payload.contacts.map(c => `@${c.name()}`).join(' ')}`, MACHINE_NAME),
              actions.assign({ contacts: (_, e) => e.payload.contacts }),
            ],
            target: States.registered,
          },
        },
      },
      [States.feedbacking]: {
        entry: [
          actions.log('states.feedbacking.entry', MACHINE_NAME),
          feedbackAddress.send(actors.register.Events.REPORT()),
        ],
        on: {
          [Types.MESSAGE]: {
            actions: feedbackAddress.send((_, e) => e),
          },
          [Types.FEEDBACKS]: {
            actions: actions.assign({ feedbacks: (_, e) => e.payload.feedbacks }),
            target: States.feedbacked,
          },
        },
      },
      [States.registered]: {
        entry: [
          actions.log('states.registered.entry', MACHINE_NAME),
          actions.send(ctx => Events.NOTICE(`欢迎${ctx.contacts.map(c => c.name()).join('，')}参加头脑风暴！`)),
        ],
        always: States.processing,
      },
      [States.feedbacked]: {
        entry: [
          actions.log('states.feedbacked.entry', MACHINE_NAME),
          actions.send(ctx => Events.NOTICE(`感谢${ctx.contacts.map(c => c.name()).join('，')}的精彩头脑风暴！`)),
        ],
        always: States.processing,
      },
    },
  })

  return machine
}

mailboxFactory.inject = [
  InjectionToken.FeedbackMailbox,
  InjectionToken.RegisterMailbox,
  InjectionToken.WechatyMailbox,
  InjectionToken.Logger,
  InjectionToken.DevTools,
] as const

function mailboxFactory (
  feedbackMailbox: Mailbox.Interface,
  registerMailbox: Mailbox.Interface,
  wechatyMailbox:  Mailbox.Interface,
  logger: Mailbox.Options['logger'],
  devTools: Mailbox.Options['devTools'],
) {
  const machine = machineFactory(
    feedbackMailbox.address,
    registerMailbox.address,
    wechatyMailbox.address,
    logger,
  )

  const mailbox = Mailbox.from(machine, {
    logger,
    devTools,
  })

  mailbox.acquire()

  return mailbox
}

export {
  machineFactory,
  mailboxFactory,
  initialContext,
  Events,
  type Context,
}
