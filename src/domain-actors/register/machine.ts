/**
 *   Wechaty Open Source Software - https://github.com/wechaty
 *
 *   @copyright 2022 Huan LI (李卓桓) <https://github.com/huan>, and
 *                   Wechaty Contributors <https://github.com/wechaty>.
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 *
 */
/* eslint-disable sort-keys */
import { createMachine, actions }   from 'xstate'
import * as CQRS                    from 'wechaty-cqrs'
import type * as PUPPET             from 'wechaty-puppet'
import * as Mailbox                 from 'mailbox'

import { removeUndefined }    from '../../pure-functions/remove-undefined.js'
import * as WechatyActor      from '../../wechaty-actor/mod.js'
import { responseStates }     from '../../actor-utils/response-states.js'

import * as NoticeActor   from '../notice/mod.js'

import duckula, { Context, Event, Events }    from './duckula.js'
import * as selectors                         from './selectors.js'

const machine = createMachine<
  Context,
  Event
>({
  id: duckula.id,
  preserveActionOrder: true,  // <- https://github.com/statelyai/xstate/issues/2891

  /**
   * Spawn a local Feedback Actor
   */
  invoke: [
    {
      id: NoticeActor.id,
      src: ctx => NoticeActor.machine.withContext({
        ...NoticeActor.initialContext(),
        actors: {
          wechaty: ctx.actors.wechaty,
        },
      }),
    },
  ],

  /**
   * Huan(202204): Global events must be internal / private
   *  or the Mailbox actor will be blocked.
   */
  on: {
    [duckula.Type.NOTICE]: {
      actions: actions.send((_, e) => e, { to: NoticeActor.id }),
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
  },

  initial: duckula.State.Initializing,
  states: {
    [duckula.State.Initializing]: {
      always: duckula.State.Idle,
    },
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

    /**
     * Idle
     *
     * 1. received MESSAGE  -> transition to Loading
     * 2. received REPORT   -> transition to Reporting
     * 3. received RESET    -> transition to Resetting
     */
    [duckula.State.Idle]: {
      entry: [
        Mailbox.actions.idle(duckula.id),
      ],
      on: {
        [duckula.Type.MESSAGE]: {
          actions: [
            actions.log('states.Idle.on.MESSAGE', duckula.id),
            actions.assign({ message: (_, e) => e.payload.message as PUPPET.payloads.MessageRoom & PUPPET.payloads.MessageBase }),
            actions.send(duckula.Event.NEXT()),
          ],
        },
        [duckula.Type.REPORT] : duckula.State.Reporting,
        [duckula.Type.RESET]  : duckula.State.Resetting,
        [duckula.Type.NEXT]   : duckula.State.Loading,
        '*'                   : duckula.State.Idle,
      },
    },

    [duckula.State.Loading]: {
      entry: [
        actions.log<Context, any>(ctx => [
          'states.Loading.entry mentionIdList: ',
          `[${ctx.message?.mentionIdList}]`,
        ].join(''), duckula.id),
        actions.send<Context, Events['MESSAGE']>(
          ctx => {
            const mentionIdList = ctx.message?.mentionIdList || []

            return WechatyActor.Event.BATCH_EXECUTE(
              mentionIdList.map(id => CQRS.queries.GetContactPayloadQuery(
                CQRS.uuid.NIL,
                id,
              )),
            )
          },
          { to: ctx => ctx.actors.wechaty },
        ),
      ],
      on: {
        [WechatyActor.Type.BATCH_RESPONSE]: {
          actions: [
            actions.log((_, e) => [
              'states.Loading.on.BATCH_RESPONSE [',
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
              duckula.Event.CONTACTS(
                e.payload.responseList
                  .filter(CQRS.is(CQRS.responses.GetContactPayloadQueryResponse))
                  .map(response => response.payload.contact)
                  .filter(removeUndefined),
              ),
            ),
          ],
        },
        [WechatyActor.Type.GERROR] : duckula.State.Erroring,
        [duckula.Type.CONTACTS]    : duckula.State.Mentioning,
      },
    },

    [duckula.State.Mentioning]: {
      entry: [
        actions.log<Context, Events['CONTACTS']>((_, e) => `states.Mentioning.entry ${e.payload.contacts.map(c => c.name).join(',')}`, duckula.id),
        actions.assign<Context, Events['CONTACTS']>({
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
        actions.log(ctx => `states.Confirming.entry contacts/${selectors.contactNum(ctx)}`, duckula.id),
        actions.choose<Context, any>([
          {
            cond: ctx => selectors.contactNum(ctx) > 0,
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

    /**
     * Reporting
     *
     * 1. context.contacts.length > 0 -> emit CONTACTS
     * 2. otherwise                   -> emit NEXT
     *
     */
    [duckula.State.Reporting]: {
      entry: [
        actions.log(ctx => `states.Reporting.entry contacts/${selectors.contactNum(ctx)}`, duckula.id),
        actions.choose<Context, any>([
          {
            cond: ctx => selectors.contactNum(ctx) > 0,
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

    ...responseStates(duckula.id),
  },
})

export default machine
