/* eslint-disable sort-keys */
import { createMachine, actions }   from 'xstate'
import * as CQRS                    from 'wechaty-cqrs'
import type * as PUPPET             from 'wechaty-puppet'
import * as Mailbox                 from 'mailbox'

import * as WechatyActor    from '../wechaty-actor/mod.js'
import * as duck            from '../duck/mod.js'

// import * as actors  from './mod.js'

const Type = {
  CONTACTS  : duck.Type.CONTACTS,
  GERROR    : duck.Type.GERROR,
  IDLE      : duck.Type.IDLE,
  INTRODUCE : duck.Type.INTRODUCE,
  MENTION   : duck.Type.MENTION,
  MESSAGE   : duck.Type.MESSAGE,
  NEXT      : duck.Type.NEXT,
  REPORT    : duck.Type.REPORT,
  RESET     : duck.Type.RESET,
} as const

// eslint-disable-next-line no-redeclare
type Type = typeof Type[keyof typeof Type]

const Event = {
  CONTACTS   : duck.Event.CONTACTS,
  GERROR     : duck.Event.GERROR,
  IDLE       : duck.Event.IDLE,
  INTRODUCE  : duck.Event.INTRODUCE,
  MENTION    : duck.Event.MENTION,
  MESSAGE    : duck.Event.MESSAGE,
  NEXT       : duck.Event.NEXT,
  REPORT     : duck.Event.REPORT,
  RESET      : duck.Event.RESET,
  BATCH_RESPONSE: WechatyActor.Event.BATCH_RESPONSE,
} as const

// eslint-disable-next-line no-redeclare
type Event = {
  [key in keyof typeof Event]: ReturnType<typeof Event[key]>
}

const State = {
  Confirming   : duck.State.confirming,
  Erroring     : duck.State.erroring,
  Idle         : duck.State.Idle,
  Initializing : duck.State.initializing,
  Mentioning   : duck.State.mentioning,
  Parsing      : duck.State.parsing,
  Reporting    : duck.State.reporting,
  Resetting    : duck.State.resetting,
} as const

// eslint-disable-next-line no-redeclare
type State = typeof State[keyof typeof State]

interface Context {
  message?: PUPPET.payloads.MessageRoom
  contacts: { [id: string]: PUPPET.payloads.Contact },
  chairs:   { [id: string]: PUPPET.payloads.Contact },
  gerror?:  string
  address?: {
    wechaty: string,
  },
}

function initialContext (): Context {
  const context: Context = {
    message  : undefined,
    contacts : {},
    chairs   : {},
    gerror   : undefined,
    address : undefined,
  }
  return JSON.parse(JSON.stringify(context))
}

const ctxRoomId     = (ctx: Context) => ctx.message!.roomId!
const ctxContactNum = (ctx: Context) => Object.keys(ctx.contacts).length

const ID = 'RegisterMachine'

const machine = createMachine<Context, Event[keyof Event]>({
  id: ID,
  initial: State.Initializing,
  preserveActionOrder: true,
  on: {
    /**
     * Huan(202203): FIXME
     *  process events outside of the `state.idle` state might block the MailBox
     *  because it does not call `Mailbox.actions.idle(...)`?
     */
    [Type.RESET]: State.Resetting,
    [Type.INTRODUCE]: {
      actions: [
        actions.send(
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
          {
            to: ctx => ctx.address!.wechaty,
          },
        ),
      ],
    },
  },
  // preserveActionOrder: true,  // <- https://github.com/statelyai/xstate/issues/2891
  states: {
    [State.Initializing]: {
      always: State.Idle,
    },
    [State.Idle]: {
      entry: [
        Mailbox.actions.idle(ID)('idle'),
      ],
      on: {
        '*': State.Idle,
        [Type.MESSAGE]: {
          actions: [
            actions.log('states.idle.on.MESSAGE', ID),
            actions.assign({ message: (_, e) => e.payload.message as PUPPET.payloads.MessageRoom }),
          ],
          target: State.Parsing,
        },
        [Type.REPORT]: {
          actions: [
            actions.log('states.idle.on.REPORT', ID),
          ],
          target: State.Reporting,
        },
      },
    },
    [State.Reporting]: {
      entry: [
        actions.log(ctx => `states.reporting.entry contacts/${ctxContactNum(ctx)}`, ID),
        actions.choose<Context, any>([
          {
            cond: ctx => ctxContactNum(ctx) > 0,
            actions: [
              actions.log(_ => 'states.reporting.entry -> [CONTACTS]', ID),
              Mailbox.actions.reply(ctx => Event.CONTACTS(Object.values(ctx.contacts))),
            ],
          },
          {
            actions: [
              actions.log(_ => 'states.reporting.entry ctx.contacts is empty', ID),
              actions.send(Event.INTRODUCE()),
            ],
          },
        ]),
      ],
      always: State.Idle,
    },
    [State.Resetting]: {
      entry: [
        actions.log('states.resetting.entry', ID),
        actions.assign(_ => initialContext()),
      ],
      always: State.Initializing,
    },
    [State.Parsing]: {
      entry: [
        actions.log((_, e) => `states.parsing.entry message mentionIdList: ${((e as Event['MESSAGE']).payload.message as PUPPET.payloads.MessageRoom).mentionIdList}`, ID),
        actions.send(
          (_, e) => {
            const messagePayload = (e as Event['MESSAGE']).payload.message
            const mentionIdList = (messagePayload as PUPPET.payloads.MessageRoom).mentionIdList || []

            return WechatyActor.Event.BATCH(
              mentionIdList.map(id => CQRS.queries.GetContactPayloadQuery(
                CQRS.uuid.NIL,
                id,
              )),
            )
          },
          {
            to: ctx => ctx.address!.wechaty,
          },
        ),
      ],
      on: {
        [WechatyActor.Type.BATCH_RESPONSE]: {
          actions: [
            actions.log((_, e) => `states.parsing.on.BATCH_RESPONSE <- #${e.payload.responseList.length}`, ID),
            actions.send((_, e) => Event.MENTION(e.payload.responseList
              .filter(CQRS.is(CQRS.responses.GetContactPayloadQueryResponse))
              .map(response => response.payload.contact)
              .filter(Boolean) as PUPPET.payloads.Contact[],
            )),
          ],
        },
        [Type.GERROR]: State.Erroring,
        [Type.MENTION]: State.Mentioning,
      },
    },
    [State.Mentioning]: {
      entry: [
        actions.log((_, e) => `states.mentioning.entry ${(e as Event['MENTION']).payload.contacts.map(c => c.name).join(',')}`, ID),
        actions.assign<Context, Event['MENTION']>({
          contacts: (ctx, e) => ({
            ...ctx.contacts,
            ...e.payload.contacts.reduce((acc, cur) => ({ ...acc, [cur.id]: cur }), {}),
          }),
        }),
        actions.send(Event.NEXT()),
      ],
      on: {
        [Type.NEXT]: State.Confirming,
      },
    },
    [State.Confirming]: {
      entry: [
        actions.log(ctx => `states.confirming.entry contacts/${ctxContactNum(ctx)}`, ID),
        actions.choose<Context, any>([
          {
            cond: ctx => ctxContactNum(ctx) > 0,
            actions: [
              actions.send(
                ctx => CQRS.commands.SendMessageCommand(
                  CQRS.uuid.NIL,
                  ctxRoomId(ctx),
                  CQRS.sayables.text(
                    [
                      '【注册系统】',
                      `恭喜：${Object.values(ctx.contacts).map(c => c.name).join('、')}，共${Object.keys(ctx.contacts).length}名组织成员注册成功！`,
                    ].join(''),
                    Object.values(ctx.contacts).map(c => c.id),
                  ),
                ),
                {
                  to: ctx => ctx.address!.wechaty,
                },
              ),
              actions.send(Event.REPORT()),
            ],
          },
          {
            actions: [
              actions.send(Event.INTRODUCE()),
              actions.send(Event.IDLE()),
            ],
          },
        ]),
      ],
      on: {
        [Type.REPORT]: State.Reporting,
        [Type.IDLE]:   State.Idle,
      },
      // TODO: ask 'do you need to edit the list?' with 60 seconds timeout with default N
    },
    [State.Erroring]: {
      entry: [
        actions.log((_, e) => `states.erroring.entry <- [GERROR(${(e as Event['GERROR']).payload.gerror})]`, ID),
        Mailbox.actions.reply((_, e) => e),
      ],
      always: State.Idle,
    },
  },
})

export {
  ID,
  Type,
  State,
  Event,
  machine,
  type Context,
  initialContext,
}
