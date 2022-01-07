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
  tips: string[],
}

const Events = {
  CONTACTS  : Bot5Events.CONTACTS,
  FEEDBACK  : Bot5Events.FEEDBACK,
  //
  INTRODUCE : Bot5Events.INTRODUCE,
  ROOM : Bot5Events.ROOM,
  MESSAGE   : Bot5Events.MESSAGE,
  RESET     : Bot5Events.RESET,
} as const

type Event = ReturnType<typeof Events[keyof typeof Events]>

const MACHINE_NAME = 'BrainstormingMachine'

function initialContext (): Context {
  const context: Context = {
    chairs    : [],
    room      : undefined,
    contacts : [],
    gerror: undefined,
    feedbacks: {},
    tips: [],
  }
  return JSON.parse(JSON.stringify(context))
}

function machineFactory (
  feedbackAddress : Mailbox.Address,
  registerAddress : Mailbox.Address,
  wechatyAddress  : Mailbox.Address,
  logger: Mailbox.MailboxOptions['logger'],
) {
  void logger
  const machine = createMachine<Context, Event>({
    id: MACHINE_NAME,
    context: () => initialContext(),
    initial: States.initializing,
    on: {
      '*': States.idle, // external transision is required by Mailbox Actor to work
      [Types.RESET]: States.resetting,
    },
    preserveActionOrder: true,
    states: {
      [States.initializing]: {
        entry: [
          actions.log('states.initializing.entry' , MACHINE_NAME),
        ],
        on: {
          [Types.ROOM]: {
            actions: [
              actions.assign({
                room: (_, e) => e.payload.room,
              }),
            ],
            target: States.introducing,
          },
        },
      },
      [States.resetting]: {
        entry: [
          actions.assign(_ => initialContext()),
        ],
        always: States.initializing,
      },
      [States.introducing]: {
        entry: [
          actions.log('states.introducing.entry', MACHINE_NAME),
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
        always: States.idle,
      },
      [States.idle]: {
        entry: [
          actions.log('states.idle.entry' , MACHINE_NAME),
          Mailbox.Actions.idle(MACHINE_NAME)('idle'),
        ],
        on: {
          '*': States.idle,
        },
        always: States.updating,
      },
      [States.updating]: {
        entry: [
          actions.log(ctx => `states.updating.entry updateMessages.length=${ctx.tips.length}`, MACHINE_NAME),
          actions.choose([
            {
              cond: ctx => ctx.tips.length > 0,
              actions: wechatyAddress.send(ctx => actors.wechaty.Events.SAY(
                `叮！系统检测到${ctx.tips.length}条新更新：
                ${
                  ctx.tips
                    .map((v, i) => `${i+1}. ${v}`)
                    .join('\n')
                }
                收获${ctx.tips.length}点经验值（可通过查看“我的经验值”查询）。
                `,
                ctx.room!.id,
                ctx.contacts.map(c => c.id),
              )),
            },
            {
              actions: wechatyAddress.send(ctx => actors.wechaty.Events.SAY(
                `系统未检测到任何更新，请宿主继续加油！`,
                ctx.room!.id,
                ctx.contacts.map(c => c.id),
              )),
            }
          ]),
        ],
        always: States.scheduling,
        exit: [
          actions.assign({ tips: _ => [] }),
        ],
      },
      [States.scheduling]: {
        entry: [
          actions.log('states.scheduling.entry', MACHINE_NAME),
        ],
        always: [
          {
            cond: ctx => ctx.contacts.length <= 0,
            target: States.registering,
          },
          {
            cond: ctx => ctx.contacts.length > Object.keys(ctx.feedbacks).length,
            target: States.feedbacking,
          },
          {
            target: States.finished,
          },
        ],
      },
      [States.registering]: {
        entry: [
          actions.log('states.registering.entry', MACHINE_NAME),
        ],
        on: {
          [Types.MESSAGE]: {
            actions: registerAddress.send((_, e) => e),

          },
          [Types.CONTACTS]: {
            actions: actions.assign({ contacts: (_, e) => e.payload.contacts }),
            target: States.registered,
          },
        },
      },
      [States.feedbacking]: {
        entry: actions.log('states.feedbacking.entry', MACHINE_NAME),
        on: {
          [Types.MESSAGE]: {
            actions: feedbackAddress.send((_, e) => e),
          },
          [Types.FEEDBACK]: {
            actions: actions.assign({ feedbacks: (_, e) => e.payload.feedbacks }),
            target: States.feedbacked,
          },
        },
      },
      [States.registered]: {
        entry: [
          actions.log('states.registered.entry', MACHINE_NAME),
          actions.assign({
            tips: ctx => [
              ...ctx.tips,
              `欢迎${ctx.contacts.map(c => c.name()).join('，')}参加头脑风暴！`,
            ],
          }),
        ],
        always: States.updating,
      },
      [States.feedbacked]: {
        entry: [
          actions.log('states.feedbacked.entry', MACHINE_NAME),
          actions.assign({
            tips: ctx => [
              ...ctx.tips,
              `感谢${ctx.contacts.map(c => c.name()).join('，')}的精彩头脑风暴！`,
            ],
          }),
        ],
        always: States.updating,
      },
      [States.finished]: {
        entry: [
          actions.log('storming.finishing', MACHINE_NAME),
          wechatyAddress.send(ctx => actors.wechaty.Events.SAY(
            `
              叮！系统检测到您已经成功完成头脑风暴，恭喜宿主！
            `,
            ctx.room!.id,
            ctx.contacts.map(c => c.id),
          )),
          Mailbox.Actions.reply(ctx => Events.FEEDBACK(ctx.feedbacks)),
        ],
        always: States.idle,
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
] as const

function mailboxFactory (
  feedbackMailbox: Mailbox.Mailbox,
  registerMailbox: Mailbox.Mailbox,
  wechatyMailbox:  Mailbox.Mailbox,
  logger: Mailbox.MailboxOptions['logger'],
) {
  const machine = machineFactory(
    feedbackMailbox.address,
    registerMailbox.address,
    wechatyMailbox.address,
    logger,
  )

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
