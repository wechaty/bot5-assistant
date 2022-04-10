/* eslint-disable sort-keys */
import {
  actions,
  createMachine,
}                     from 'xstate'
import type {
  Contact,
  Room,
}                     from 'wechaty'
import * as Mailbox   from 'mailbox'

import * as duck            from '../duck/mod.js'
import { InjectionToken }   from '../ioc/mod.js'

import * as actors          from './mod.js'

interface Context {
  chairs   : Contact[],
  room?    : Room,
  contacts : Contact[],
  gerror?   : string,
  feedbacks: {
    [id: string]: string,
  },
}

const Events = {
  CONTACTS  : duck.Event.CONTACTS,
  FEEDBACKS : duck.Event.FEEDBACKS,
  //
  INTRODUCE : duck.Event.INTRODUCE,
  ROOM      : duck.Event.ROOM,
  MESSAGE   : duck.Event.MESSAGE,
  RESET     : duck.Event.RESET,
  REPORT    : duck.Event.REPORT,
  NOTICE    : duck.Event.NOTICE,
  IDLE      : duck.Event.IDLE,
  PROCESS   : duck.Event.PROCESS,
} as const

type Event = ReturnType<typeof Events[keyof typeof Events]>

const ctxFeedbacksNum = (ctx: Context) => Object.values(ctx.feedbacks).filter(Boolean).length
const ctxContactsNum  = (ctx: Context) => ctx.contacts.length

const MACHINE_NAME = 'BrainstormingMachine'

function initialContext (): Context {
  const context: Context = {
    chairs    : [],
    room      : undefined,
    contacts : [],
    gerror: undefined,
    feedbacks: {},
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
    initial: duck.State.initializing,
    on: {
      // '*': States.idle, // external transision is required by Mailbox Actor to work
      [duck.Type.RESET]: duck.State.resetting,
      [duck.Type.NOTICE]: {
        actions: [
          actions.log((_, e) => `on.NOTICE ${e.payload.notice}`, MACHINE_NAME),
          wechatyAddress.send((ctx, e) => actors.wechaty.Event.SAY(
            [
              '【脑爆系统】叮！系统检测到通知，请注意查收！',
              '-------',
              e.payload.notice,
            ].join('\n'),
            ctx.room!.id,
            ctx.contacts.map(c => c.id),
          )),
        ],
      },
      [duck.Type.INTRODUCE]: {
        actions: [
          actions.log('on.INTRODUCE', MACHINE_NAME),
          wechatyAddress.send(ctx => actors.wechaty.duck.Event.SAY(
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
      [duck.State.initializing]: {
        entry: [
          actions.log('duck.State.initializing.entry', MACHINE_NAME),
        ],
        always: duck.State.Idle,
      },
      [duck.State.resetting]: {
        entry: [
          actions.log('duck.State.resetting.entry', MACHINE_NAME),
          actions.assign(_ => initialContext()),
        ],
        always: duck.State.initializing,
      },
      [duck.State.Idle]: {
        entry: [
          actions.log('duck.State.Idle.entry', MACHINE_NAME),
          Mailbox.actions.idle(MACHINE_NAME)('idle'),
        ],
        on: {
          [duck.Type.REPORT]: {
            target: duck.State.reporting,
          },
          [duck.Type.ROOM]: {
            actions: actions.assign({ room: (_, e) => e.payload.room }),
            target: duck.State.Idle,
          },
        },
      },
      [duck.State.reporting]: {
        entry: [
          actions.log(ctx => `duck.State.reporting.entry feedbacks(${ctxFeedbacksNum(ctx)})`, MACHINE_NAME),
          actions.choose<Context, any>([
            {
              cond: ctx => ctxFeedbacksNum(ctx) > 0,
              actions: [
                actions.log('duck.State.reporting.entry -> [FEEDBACKS], [IDLE]', MACHINE_NAME),
                Mailbox.actions.reply(ctx => Events.FEEDBACKS(ctx.feedbacks)),
                actions.send(Events.IDLE()),
              ],
            },
            {
              actions: [
                actions.log('duck.State.reporting.entry -> [PROCESS]', MACHINE_NAME),
                actions.send(Events.PROCESS()),
              ],
            },
          ]),
        ],
        on: {
          [duck.Type.IDLE]:     duck.State.Idle,
          [duck.Type.PROCESS]:  duck.State.processing,
        },
      },
      [duck.State.processing]: {
        entry: [
          actions.log('duck.State.processing.entry', MACHINE_NAME),
        ],
        always: [
          {
            cond: ctx => ctxContactsNum(ctx) <= 0,
            target: duck.State.registering,
          },
          {
            cond: ctx => ctxFeedbacksNum(ctx) < ctxContactsNum(ctx),
            target: duck.State.feedbacking,
          },
          {
            actions: [
              wechatyAddress.send(ctx => actors.wechaty.duck.Event.SAY(
                '【脑爆系统】叮！系统检测到您已经成功完成头脑风暴，恭喜宿主！',
                ctx.room!.id,
                ctx.contacts.map(c => c.id),
              )),
            ],
            target: duck.State.reporting,
          },
        ],
      },
      [duck.State.registering]: {
        entry: [
          actions.log('duck.State.registering.entry', MACHINE_NAME),
          registerAddress.send(actors.register.duck.Event.report()),
        ],
        on: {
          [duck.Type.MESSAGE]: {
            actions: registerAddress.send((_, e) => e),
          },
          [duck.Type.CONTACTS]: {
            actions: [
              actions.log((_, e) => `duck.State.registering.on.CONTACTS ${e.payload.contacts.map(c => `@${c.name()}`).join(' ')}`, MACHINE_NAME),
              actions.assign({ contacts: (_, e) => e.payload.contacts }),
            ],
            target: duck.State.registered,
          },
        },
      },
      [duck.State.feedbacking]: {
        entry: [
          actions.log('duck.State.feedbacking.entry', MACHINE_NAME),
          feedbackAddress.send(actors.register.Events.report()),
        ],
        on: {
          [duck.Type.MESSAGE]: {
            actions: feedbackAddress.send((_, e) => e),
          },
          [duck.Type.FEEDBACKS]: {
            actions: actions.assign({ feedbacks: (_, e) => e.payload.feedbacks }),
            target: duck.State.feedbacked,
          },
        },
      },
      [duck.State.registered]: {
        entry: [
          actions.log('duck.State.registered.entry', MACHINE_NAME),
          actions.send(ctx => Events.NOTICE(`欢迎${ctx.contacts.map(c => c.name()).join('，')}参加头脑风暴！`)),
        ],
        always: duck.State.processing,
      },
      [duck.State.feedbacked]: {
        entry: [
          actions.log('duck.State.feedbacked.entry', MACHINE_NAME),
          actions.send(ctx => Events.NOTICE(`感谢${ctx.contacts.map(c => c.name()).join('，')}的精彩头脑风暴！`)),
        ],
        always: duck.State.processing,
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

  return mailbox
}

export {
  machineFactory,
  mailboxFactory,
  initialContext,
  Events,
  type Context,
}
