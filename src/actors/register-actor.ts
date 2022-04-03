/* eslint-disable sort-keys */
import { createMachine, actions }   from 'xstate'
import * as CQRS                    from 'wechaty-cqrs'
import type * as PUPPET             from 'wechaty-puppet'
import * as Mailbox                 from 'mailbox'

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
} as const

const events = {
  contacts   : schemas.events.contacts,
  message    : schemas.events.message,
  reset      : schemas.events.reset,
  report     : schemas.events.report,
  introduce  : schemas.events.introduce,
  mention    : schemas.events.mention,
  gerror     : schemas.events.gerror,
  idle       : schemas.events.idle,
} as const

type Event =
  | ReturnType<typeof events[keyof typeof events]>
  | CQRS.duck.Event

type Events = {
  [key in keyof typeof events]: typeof events[key]
}

const states = {
  confirming   : schemas.states.confirming,
  erroring     : schemas.states.erroring,
  idle         : schemas.states.idle,
  initializing : schemas.states.initializing,
  parsing      : schemas.states.parsing,
  // loading      : schemas.states.loading,
  reporting    : schemas.states.reporting,
  resetting    : schemas.states.resetting,
} as const

type State = typeof states[keyof typeof states]

interface Context {
  message?: PUPPET.payloads.Message
  contacts: PUPPET.payloads.Contact[],
  chairs:   PUPPET.payloads.Contact[],
  gerror?:  string
}

function initialContext (): Context {
  const context: Context = {
    message  : undefined,
    contacts : [],
    chairs   : [],
    gerror   : undefined,
  }
  return JSON.parse(JSON.stringify(context))
}

const ctxRoom         = (ctx: Context) => ctx.message!.roomId!
const ctxContactsNum  = (ctx: Context) => Object.keys(ctx.contacts).length

const MACHINE_NAME = 'RegisterMachine'

const machineFactory = (
  wechatyAddress: Mailbox.Address,
  // logger: Mailbox.Options['logger'],
) => createMachine<Context, Event>({
  id: MACHINE_NAME,
  initial: states.initializing,
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
            ctxRoom(ctx),
            CQRS.sayables.text(
              [
                '【注册系统】说用说明书：',
                '请主席发送一条消息，同时一次性 @ 所有参会人员，即可完成参会活动人员注册。',
                `当前注册人数：${ctx.contacts.length}`,
              ].join(''),
              ctx.chairs.map(c => c.id),
            ),
          ),
        ),
      ],
    },
  },
  preserveActionOrder: true,  // <- https://github.com/statelyai/xstate/issues/2891
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
            actions.assign({ message: (_, e) => e.payload.message }),
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
        actions.log(ctx => `states.reporting.entry contacts/${ctxContactsNum(ctx)}`, MACHINE_NAME),
        actions.choose<Context, any>([
          {
            cond: ctx => ctxContactsNum(ctx) > 0,
            actions: [
              actions.log(_ => 'states.reporting.entry -> [CONTACTS]', MACHINE_NAME),
              Mailbox.actions.reply(ctx => events.contacts(ctx.contacts)),
            ],
          },
          {
            actions: [
              actions.log(_ => 'states.reporting.entry ctx.contacts is empty', MACHINE_NAME),
              actions.send(events.introduce()),
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
    loading: {
      entry: [
        wechatyAddress.send((ctx, e) => CQRS.queries.GetContactPayloadQuery(
          CQRS.uuid.NIL,
          e.payload.contactId,
        )),
      ],
      on: {
        [CQRS.duck.types.GET_CONTACT_PAYLOAD_QUERY_RESPONSE]: 'looping',
      }
    },
    looping: {
      entry: [
        actions.choose([
          {
            cond: ctx => ctxContactsNum(ctx) < 1,
          }
        ])
      ]
      onDone: {
        actions: actions.send((_, e) => events.mention(e.data)),
      },
      onError: {
        actions: actions.send((_, e) => events.gerror(e.data)),
      },
      on: {
        [types.MENTION]: {
          actions: [
            actions.log((_, e) => `states.parsing.on.MENTION <- ${e.payload.contacts.map(c => c.name).join(',')}`, MACHINE_NAME),
            actions.assign({
              contacts: (ctx, e) => [
                ...ctx.contacts,
                ...e.payload.contacts.filter(c => !ctx.contacts.map(c => c.id).includes(c.id)),
              ],
            }),
          ],
          target: states.confirming,
        },
        [types.GERROR]: states.erroring,
      },
    },
    [states.parsing]: {
      entry: [
        actions.log('states.parsing.entry', MACHINE_NAME),
        actions.choose([
          {
            cond: ctx => !!ctx.message
              && 'mentionIdList' in ctx.message
              && !!ctx.message.mentionIdList
              /**
               * Condition: there are more contact payloads need to be loaded
               */
              && ctx.message.mentionIdList.length > ctx.contacts.length,
            actions: actions.send(ctx => ({
              type: 'LOAD',
              payload: {
                contactId: (ctx.message as PUPPET.payloads.MessageRoom)
                  .mentionIdList!
                  .filter(id => !ctx.contacts
                    .map(c => c.id)
                    .includes(id),
                  ),
              },
            }))
          }
        ])
        actions.send(ctx => ctx.message && 'mentionIdList' in ctx.message && ctx.message.mentionIdList
          ? ({ type: 'LOOP', payload: { mentionIds: ctx.message.mentionIdList, contacts: [] } })
          : ({ type: 'LOOP', payload: { mentionIds: [], contacts: [] } })
        ),
      ],
    },
    [states.confirming]: {
      entry: [
        actions.log(ctx => `states.confirming.entry contacts/${ctxContactsNum(ctx)}`, MACHINE_NAME),
        actions.choose<Context, any>([
          {
            cond: ctx => ctxContactsNum(ctx) > 0,
            actions: [
              wechatyAddress.send(ctx => CQRS.commands.SendMessageCommand(
                CQRS.uuid.NIL,
                ctxRoom(ctx),
                CQRS.sayables.text(
                  [
                    '【注册系统】',
                    `恭喜：${ctx.contacts.map(c => c.name).join('、')}，共${ctx.contacts.length}名组织成员注册成功！`,
                  ].join(''),
                  Object.values(ctx.contacts).map(c => c.id),
                ),
              )),
              actions.send(events.report()),
            ],
          },
          {
            actions: [
              actions.send(events.introduce()),
              actions.send(events.idle()),
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
        actions.log((_, e) => `states.erroring.entry <- [GERROR(${(e as schemas.Events['gerror']).payload.gerror})]`, MACHINE_NAME),
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
