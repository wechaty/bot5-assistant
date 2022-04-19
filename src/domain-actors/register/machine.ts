/* eslint-disable sort-keys */
import { createMachine, actions }   from 'xstate'
import * as CQRS                    from 'wechaty-cqrs'
import type * as PUPPET             from 'wechaty-puppet'
import * as Mailbox                 from 'mailbox'

import duckula from './duckula.js'

const ctxRoomId     = (ctx: ReturnType<typeof duckula.initialContext>) => ctx.message!.roomId!
const ctxContactNum = (ctx: ReturnType<typeof duckula.initialContext>) => Object.keys(ctx.contacts).length

const machine = createMachine<
  ReturnType<typeof duckula.initialContext>,
  ReturnType<typeof duckula.Event[keyof typeof duckula.Event]>
>({
  id: duckula.id,
  initial: duckula.State.Initializing,
  preserveActionOrder: true,
  on: {
    /**
     * Huan(202203): FIXME
     *  process events outside of the `duckula.state.idle` state might block the MailBox
     *  because it does not call `Mailbox.actions.idle(...)`?
     */
    [duckula.Type.RESET]: duckula.State.Resetting,
    [duckula.Type.INTRODUCE]:{
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
          { to: ctx => ctx.address!.wechaty },
        ),
      ],
    },
  },
  // preserveActionOrder: true,  // <- https://github.com/statelyai/xstate/issues/2891
  states: {
    [duckula.State.Initializing]: {
      always: duckula.State.Idle,
    },
    [duckula.State.Idle]: {
      entry: [
        Mailbox.actions.idle(duckula.id)('idle'),
      ],
      on: {
        '*': duckula.State.Idle,
        [duckula.Type.MESSAGE]: {
          actions: [
            actions.log('states.idle.on.MESSAGE', duckula.id),
            actions.assign({ message: (_, e) => e.payload.message as PUPPET.payloads.MessageRoom }),
          ],
          target: duckula.State.Parsing,
        },
        [duckula.Type.REPORT]: {
          actions: [
            actions.log('states.idle.on.REPORT', duckula.id),
          ],
          target: duckula.State.Reporting,
        },
      },
    },
    [duckula.State.Reporting]: {
      entry: [
        actions.log(ctx => `states.reporting.entry contacts/${ctxContactNum(ctx)}`, duckula.id),
        actions.choose<ReturnType<typeof duckula.initialContext>, any>([
          {
            cond: ctx => ctxContactNum(ctx) > 0,
            actions: [
              actions.log(_ => 'states.reporting.entry -> [CONTACTS]', duckula.id),
              Mailbox.actions.reply(ctx => duckula.Event.CONTACTS(Object.values(ctx.contacts))),
            ],
          },
          {
            actions: [
              actions.log(_ => 'states.reporting.entry ctx.contacts is empty', duckula.id),
              actions.send(duckula.Event.INTRODUCE()),
            ],
          },
        ]),
      ],
      always: duckula.State.Idle,
    },

    [duckula.State.Resetting]: {
      entry: [
        actions.log('states.resetting.entry', duckula.id),
        actions.assign(_ => duckula.initialContext()),
      ],
      always: duckula.State.Initializing,
    },

    [duckula.State.Parsing]: {
      entry: [
        actions.log((_, e) => [
          'states.parsing.entry message mentionIdList: [',
          (
            (e as ReturnType<typeof duckula.Event['MESSAGE']>)
              .payload
              .message as PUPPET.payloads.MessageRoom
          ).mentionIdList,
          ']',
        ].join(''), duckula.id),
        actions.send(
          (_, e) => {
            const messagePayload = (e as ReturnType<typeof duckula.Event['MESSAGE']>).payload.message
            const mentionIdList = (messagePayload as PUPPET.payloads.MessageRoom).mentionIdList || []

            return duckula.Event.BATCH(
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
        [duckula.Type.BATCH_RESPONSE]: {
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
            actions.send((_, e) => duckula.Event.MENTION(e.payload.responseList
              .filter(CQRS.is(CQRS.responses.GetContactPayloadQueryResponse))
              .map(response => response.payload.contact)
              .filter(Boolean) as PUPPET.payloads.Contact[],
            )),
          ],
        },
        [duckula.Type.GERROR]: duckula.State.Erroring,
        [duckula.Type.MENTION]: duckula.State.Mentioning,
      },
    },

    [duckula.State.Mentioning]: {
      entry: [
        actions.log((_, e) => `states.mentioning.entry ${(e as ReturnType<typeof duckula.Event['MENTION']>).payload.contacts.map(c => c.name).join(',')}`, duckula.id),
        actions.assign<ReturnType<typeof duckula.initialContext>, ReturnType<typeof duckula.Event['MENTION']>>({
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
        actions.log(ctx => `states.confirming.entry contacts/${ctxContactNum(ctx)}`, duckula.id),
        actions.choose<ReturnType<typeof duckula.initialContext>, any>([
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
                { to: ctx => ctx.address!.wechaty },
              ),
              actions.send(duckula.Event.REPORT()),
            ],
          },
          {
            actions: [
              actions.send(duckula.Event.INTRODUCE()),
              actions.send(duckula.Event.IDLE()),
            ],
          },
        ]),
      ],
      on: {
        [duckula.Type.REPORT]: duckula.State.Reporting,
        [duckula.Type.IDLE]:   duckula.State.Idle,
      },
      // TODO: ask 'do you need to edit the list?' with 60 seconds timeout with default N
    },

    [duckula.State.Erroring]: {
      entry: [
        actions.log(
          (_, e) =>
            [
              'State.Erroring.entry [GERROR]: ',
              (e as ReturnType<typeof duckula.Event['GERROR']>)
                .payload
                .gerror,
            ].join(''),
          duckula.id,
        ),
        Mailbox.actions.reply((_, e) => e),
      ],
      always: duckula.State.Idle,
    },
  },
})

export default machine
