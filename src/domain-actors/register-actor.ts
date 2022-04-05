/* eslint-disable sort-keys */
import { createMachine, actions }   from 'xstate'
import * as CQRS                    from 'wechaty-cqrs'
import type * as PUPPET             from 'wechaty-puppet'
import * as Mailbox                 from 'mailbox'

import * as ACTOR           from '../wechaty-actor/mod.js'
import * as schemas         from '../schemas/mod.js'
import { InjectionToken }   from '../ioc/tokens.js'

// import * as actors  from './mod.js'

const types = {
  GERROR    : schemas.types.GERROR,
  IDLE      : schemas.types.IDLE,
  INTRODUCE : schemas.types.INTRODUCE,
  MENTION   : schemas.types.MENTION,
  MESSAGE   : schemas.types.MESSAGE,
  REPORT    : schemas.types.REPORT,
  RESET     : schemas.types.RESET,
  NEXT      : schemas.types.NEXT,
} as const

const events = {
  CONTACTS   : schemas.events.CONTACTS,
  GERROR     : schemas.events.GERROR,
  IDLE       : schemas.events.IDLE,
  INTRODUCE  : schemas.events.INTRODUCE,
  MENTION    : schemas.events.MENTION,
  MESSAGE    : schemas.events.MESSAGE,
  NEXT       : schemas.events.NEXT,
  REPORT     : schemas.events.REPORT,
  RESET      : schemas.events.RESET,
} as const

type Event =
  | ReturnType<typeof events[keyof typeof events]>
  | CQRS.duck.Event
  | ACTOR.Event

type Events = {
  [key in keyof typeof events]: ReturnType<typeof events[key]>
}

const states = {
  confirming   : schemas.states.confirming,
  erroring     : schemas.states.erroring,
  idle         : schemas.states.idle,
  initializing : schemas.states.initializing,
  mentioning   : schemas.states.mentioning,
  parsing      : schemas.states.parsing,
  reporting    : schemas.states.reporting,
  resetting    : schemas.states.resetting,
} as const

type State = typeof states[keyof typeof states]

interface Context {
  message?: PUPPET.payloads.MessageRoom
  contacts: { [id: string]: PUPPET.payloads.Contact },
  chairs:   { [id: string]: PUPPET.payloads.Contact },
  gerror?:  string
}

function initialContext (): Context {
  const context: Context = {
    message  : undefined,
    contacts : {},
    chairs   : {},
    gerror   : undefined,
  }
  return JSON.parse(JSON.stringify(context))
}

const ctxRoomId     = (ctx: Context) => ctx.message!.roomId!
const ctxContactNum = (ctx: Context) => Object.keys(ctx.contacts).length

const MACHINE_NAME = 'RegisterMachine'

const machineFactory = (
  wechatyAddress: Mailbox.Address,
  // logger: Mailbox.Options['logger'],
) => createMachine<Context, Event>({
  id: MACHINE_NAME,
  initial: states.initializing,
  preserveActionOrder: true,
  context: () => initialContext(),
  on: {
    /**
     * Huan(202203): FIXME
     *  process events outside of the `state.idle` state might block the MailBox
     *  because it does not call `Mailbox.actions.idle(...)`?
     */
    [types.RESET]: schemas.states.resetting,
    [types.INTRODUCE]: {
      actions: [
        wechatyAddress.send(
          ctx => CQRS.commands.SendMessageCommand(
            CQRS.uuid.NIL,
            ctxRoomId(ctx),
            CQRS.sayables.text(
              [
                '【注册系统】说用说明书：',
                '请主席发送一条消息，同时一次性 @ 所有参会人员，即可完成参会活动人员注册。',
                `当前注册人数：${Object.keys(ctx.contacts).length}`,
              ].join(''),
              Object.keys(ctx.chairs),
            ),
          ),
        ),
      ],
    },
  },
  // preserveActionOrder: true,  // <- https://github.com/statelyai/xstate/issues/2891
  states: {
    [states.initializing]: {
      always: states.idle,
    },
    [states.idle]: {
      entry: [
        Mailbox.actions.idle(MACHINE_NAME)('idle'),
      ],
      on: {
        '*': states.idle,
        [types.MESSAGE]: {
          actions: [
            actions.log('states.idle.on.MESSAGE', MACHINE_NAME),
            actions.assign({ message: (_, e) => e.payload.message as PUPPET.payloads.MessageRoom }),
          ],
          target: states.parsing,
        },
        [types.REPORT]: {
          actions: [
            actions.log('states.idle.on.REPORT', MACHINE_NAME),
          ],
          target: states.reporting,
        },
      },
    },
    [states.reporting]: {
      entry: [
        actions.log(ctx => `states.reporting.entry contacts/${ctxContactNum(ctx)}`, MACHINE_NAME),
        actions.choose<Context, any>([
          {
            cond: ctx => ctxContactNum(ctx) > 0,
            actions: [
              actions.log(_ => 'states.reporting.entry -> [CONTACTS]', MACHINE_NAME),
              Mailbox.actions.reply(ctx => events.CONTACTS(Object.values(ctx.contacts))),
            ],
          },
          {
            actions: [
              actions.log(_ => 'states.reporting.entry ctx.contacts is empty', MACHINE_NAME),
              actions.send(events.INTRODUCE()),
            ],
          },
        ]),
      ],
      always: states.idle,
    },
    [states.resetting]: {
      entry: [
        actions.log('states.resetting.entry', MACHINE_NAME),
        actions.assign(_ => initialContext()),
      ],
      always: states.initializing,
    },
    [states.parsing]: {
      entry: [
        actions.log((_, e) => `states.parsing.entry message mentionIdList: ${((e as Events['MESSAGE']).payload.message as PUPPET.payloads.MessageRoom).mentionIdList}`, MACHINE_NAME),
        wechatyAddress.send((_, e) => {
          const messagePayload = (e as Events['MESSAGE']).payload.message
          const mentionIdList = (messagePayload as PUPPET.payloads.MessageRoom).mentionIdList || []

          return ACTOR.events.batch(
            mentionIdList.map(id => CQRS.queries.GetContactPayloadQuery(
              CQRS.uuid.NIL,
              id,
            )),
          )
        }),
      ],
      on: {
        [ACTOR.types.BATCH_RESPONSE]: {
          actions: [
            actions.log((_, e) => `states.parsing.on.BATCH_RESPONSE <- #${e.payload.responseList.length}`, MACHINE_NAME),
            actions.send((_, e) => events.MENTION(e.payload.responseList
              .filter(CQRS.is(CQRS.responses.GetContactPayloadQueryResponse))
              .map(response => response.payload.contact)
              .filter(Boolean) as PUPPET.payloads.Contact[],
            )),
          ],
        },
        [types.GERROR]: states.erroring,
        [types.MENTION]: states.mentioning,
      },
    },
    [states.mentioning]: {
      entry: [
        actions.log((_, e) => `states.mentioning.entry ${(e as Events['MENTION']).payload.contacts.map(c => c.name).join(',')}`, MACHINE_NAME),
        actions.assign<Context, Events['MENTION']>({
          contacts: (ctx, e) => ({
            ...ctx.contacts,
            ...e.payload.contacts.reduce((acc, cur) => ({ ...acc, [cur.id]: cur }), {}),
          }),
        }),
        actions.send(events.NEXT()),
      ],
      on: {
        [types.NEXT]: states.confirming,
      },
    },
    [states.confirming]: {
      entry: [
        actions.log(ctx => `states.confirming.entry contacts/${ctxContactNum(ctx)}`, MACHINE_NAME),
        actions.choose<Context, any>([
          {
            cond: ctx => ctxContactNum(ctx) > 0,
            actions: [
              wechatyAddress.send(ctx => CQRS.commands.SendMessageCommand(
                CQRS.uuid.NIL,
                ctxRoomId(ctx),
                CQRS.sayables.text(
                  [
                    '【注册系统】',
                    `恭喜：${Object.values(ctx.contacts).map(c => c.name).join('、')}，共${Object.keys(ctx.contacts).length}名组织成员注册成功！`,
                  ].join(''),
                  Object.values(ctx.contacts).map(c => c.id),
                ),
              )),
              actions.send(events.REPORT()),
            ],
          },
          {
            actions: [
              actions.send(events.INTRODUCE()),
              actions.send(events.IDLE()),
            ],
          },
        ]),
      ],
      on: {
        [types.REPORT]: states.reporting,
        [types.IDLE]:   states.idle,
      },
      // TODO: ask 'do you need to edit the list?' with 60 seconds timeout with default N
    },
    [states.erroring]: {
      entry: [
        actions.log((_, e) => `states.erroring.entry <- [GERROR(${(e as schemas.Events['GERROR']).payload.gerror})]`, MACHINE_NAME),
        Mailbox.actions.reply((_, e) => e),
      ],
      always: states.idle,
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
  return mailbox
}

export {
  type Context,
  type State,
  type Event,
  type Events,
  events,
  machineFactory,
  mailboxFactory,
  initialContext,
}
