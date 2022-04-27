/* eslint-disable sort-keys */
import { createMachine, actions }   from 'xstate'
import * as CQRS                    from 'wechaty-cqrs'
import type * as PUPPET             from 'wechaty-puppet'
import * as Mailbox                 from 'mailbox'

import { removeUndefined }  from '../../pure-functions/remove-undefined.js'
import * as WechatyDuckula  from '../../wechaty-actor/mod.js'

import duckula, { Context, Event, Events } from './duckula.js'

// const ctxRoomId     = (ctx: ReturnType<typeof duckula.initialContext>) => ctx.message!.roomId!
const ctxContactNum = (ctx: ReturnType<typeof duckula.initialContext>) => Object.keys(ctx.contacts).length

const machine = createMachine<
  Context,
  Event
>({
  id: duckula.id,
  preserveActionOrder: true,  // <- https://github.com/statelyai/xstate/issues/2891

  on: {
    [duckula.Type.NOTICE]: {
      actions: actions.send((_, e) => e, { to: ctx => ctx.address.noticing }),
    },
    [duckula.Type.INTRODUCE]: {
      actions: actions.send(
        ctx => duckula.Event.NOTICE(
          [
            '【注册系统】说用说明书：',
            '请主席发送一条消息，同时一次性 @ 所有参会人员，即可完成参会活动人员注册。',
            `当前注册人数：${Object.keys(ctx.contacts).length}`,
          ].join(''),
          Object.keys(ctx.chairs),
        ),
      ),
    },
    [duckula.Type.RESET]: duckula.State.Resetting,
  },

  initial: duckula.State.Initializing,
  states: {
    [duckula.State.Resetting]: {
      entry: [
        actions.log('states.Resetting.entry', duckula.id),
        actions.assign(ctx => ({
          ...ctx,
          ...duckula.initialContext(),
        })),
      ],
      always: duckula.State.Initializing,
    },
    [duckula.State.Initializing]: {
      always: duckula.State.Idle,
    },

    /**
     *
     * Idle
     *
     *  1. received MESSAGE  -> transition to Parsing
     *  2. received REPORT   -> transition to Reporting
     *
     */
    [duckula.State.Idle]: {
      entry: [
        Mailbox.actions.idle(duckula.id)('idle'),
      ],
      on: {
        [duckula.Type.MESSAGE]: {
          actions: [
            actions.log('states.Idle.on.MESSAGE', duckula.id),
            actions.assign({ message: (_, e) => e.payload.message as PUPPET.payloads.MessageRoom }),
          ],
          target: duckula.State.Parsing,
        },
        [duckula.Type.REPORT]: {
          actions: [
            actions.log('states.Idle.on.REPORT', duckula.id),
          ],
          target: duckula.State.Reporting,
        },
        '*': duckula.State.Idle,
      },
    },

    /**
     * 1. context.contacts.length > 0 -> emit CONTACTS
     * 2. otherwise                   -> emit INTRODUCE
     */
    [duckula.State.Reporting]: {
      entry: [
        actions.log(ctx => `states.Reporting.entry contacts/${ctxContactNum(ctx)}`, duckula.id),
        actions.choose<ReturnType<typeof duckula.initialContext>, any>([
          {
            cond: ctx => ctxContactNum(ctx) > 0,
            actions: [
              actions.log(_ => 'states.Reporting.entry -> [CONTACTS]', duckula.id),
              actions.send(ctx => duckula.Event.CONTACTS(Object.values(ctx.contacts))),
            ],
          },
          {
            actions: [
              actions.log(_ => 'states.Reporting.entry ctx.contacts is empty', duckula.id),
              actions.send(duckula.Event.INTRODUCE()),
              actions.send(duckula.Event.NEXT()),
            ],
          },
        ]),
      ],
      on: {
        [duckula.Type.CONTACTS] : duckula.State.Responding,
        [duckula.Type.NEXT]     : duckula.State.Idle,
      },
    },

    [duckula.State.Parsing]: {
      entry: [
        actions.log<Context, Events['MESSAGE']>((_, e) => [
          'states.Parsing.entry message mentionIdList: ',
          `[${(e.payload.message as PUPPET.payloads.MessageRoom).mentionIdList}]`,
        ].join(''), duckula.id),
        actions.send(
          (_, e) => {
            const messagePayload = (e as ReturnType<typeof duckula.Event['MESSAGE']>).payload.message
            const mentionIdList = (messagePayload as PUPPET.payloads.MessageRoom).mentionIdList || []

            return WechatyDuckula.Event.BATCH_EXECUTE(
              mentionIdList.map(id => CQRS.queries.GetContactPayloadQuery(
                CQRS.uuid.NIL,
                id,
              )),
            )
          },
          { to: ctx => ctx.address!.wechaty },
        ),
      ],
      on: {
        [WechatyDuckula.Type.BATCH_RESPONSE]: {
          actions: [
            actions.log((_, e) => [
              'State.Parsing.on.BATCH_RESPONSE [',
              [
                ...new Set(
                  e.payload
                    .responseList
                    .map(r => r.type),
                ),
              ].join(','),
              ']#',
              e.payload.responseList.length,
            ].join(''), duckula.id),
            actions.send((_, e) =>
              duckula.Event.MENTION(
                e.payload.responseList
                  .filter(CQRS.is(CQRS.responses.GetContactPayloadQueryResponse))
                  .map(response => response.payload.contact)
                  .filter(removeUndefined),
              ),
            ),
          ],
        },
        [WechatyDuckula.Type.GERROR] : duckula.State.Erroring,
        [duckula.Type.MENTION]       : duckula.State.Mentioning,
      },
    },

    [duckula.State.Mentioning]: {
      entry: [
        actions.log<Context, Events['MENTION']>((_, e) => `states.Mentioning.entry ${e.payload.contacts.map(c => c.name).join(',')}`, duckula.id),
        actions.assign<Context, Events['MENTION']>({
          contacts: (ctx, e) => ({
            ...ctx.contacts,
            ...e.payload.contacts.reduce((acc, cur) => ({ ...acc, [cur.id]: cur }), {}),
          }),
        }),
        actions.send(duckula.Event.NEXT()),
      ],
      on: {
        [duckula.Type.NEXT]: duckula.State.Confirming,
      },
    },
    [duckula.State.Confirming]: {
      entry: [
        actions.log(ctx => `states.Confirming.entry contacts/${ctxContactNum(ctx)}`, duckula.id),
        actions.choose<Context, any>([
          {
            cond: ctx => ctxContactNum(ctx) > 0,
            actions: [
              actions.send(
                ctx => duckula.Event.NOTICE(
                  [
                    '【注册系统】',
                    `恭喜：${Object.values(ctx.contacts).map(c => c.name).join('、')}，`,
                    `共${Object.keys(ctx.contacts).length}名组织成员注册成功！`,
                  ].join(''),
                  Object.keys(ctx.contacts),
                ),
              ),
              actions.send(duckula.Event.REPORT()),
            ],
          },
          {
            actions: [
              actions.send(duckula.Event.INTRODUCE()),
              actions.send(duckula.Event.NEXT()),
            ],
          },
        ]),
      ],
      on: {
        [duckula.Type.REPORT] : duckula.State.Reporting,
        [duckula.Type.NEXT]   : duckula.State.Idle,
      },
      // TODO: ask 'do you need to edit the list?' with 60 seconds timeout with default N
    },

    [duckula.State.Responding]: {
      entry: [
        Mailbox.actions.reply((_, e) => e),
      ],
      always: duckula.State.Idle,
    },

    [duckula.State.Erroring]: {
      entry: [
        actions.log<Context, Events['GERROR']>((_, e) => `states.Erroring.entry GERROR: ${e.payload.gerror}`, duckula.id),
        Mailbox.actions.reply((_, e) => e),
      ],
      always: duckula.State.Idle,
    },
  },
})

export default machine
