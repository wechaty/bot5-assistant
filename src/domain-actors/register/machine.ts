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
import * as Mailbox                 from 'mailbox'

import type * as WechatyActor   from '../../wechaty-actor/mod.js'
import { responseStates }       from '../../actor-utils/response-states.js'
import {
  MessageToRoom,
  MessageToMentions,
  MessageToIntents,
}                               from '../../application-actors/mod.js'
import { invokeId }             from '../../actor-utils/invoke-id.js'
import { Intent }               from '../../intents/mod.js'

import * as Notice    from '../notice/mod.js'

import duckula, { Context, Event }    from './duckula.js'

const machine = createMachine<
  Context,
  Event
    | WechatyActor.Events[keyof WechatyActor.Events]
>({
  id: duckula.id,

  /**
   * Spawn Notice, MessageToIntent, MessageToMention, MessageToRoom Actors
   */
  invoke: [
    {
      id: invokeId(Notice.id, duckula.id),
      src: ctx => Mailbox.wrap(
        Notice.machine.withContext({
          ...Notice.initialContext(),
          actors: {
            wechaty: ctx.actors.wechaty,
          },
        }),
      ),
    },
    {
      id: invokeId(MessageToIntents.id, duckula.id),
      src: ctx => Mailbox.wrap(
        MessageToIntents.machine.withContext({
          ...MessageToIntents.initialContext(),
          actors: {
            wechaty: ctx.actors.wechaty,
          },
        }),
      ),
    },
    {
      id: invokeId(MessageToMentions.id, duckula.id),
      src: ctx => Mailbox.wrap(
        MessageToMentions.machine.withContext({
          ...MessageToMentions.initialContext(),
          actors: {
            wechaty: ctx.actors.wechaty,
          },
        }),
      ),
    },
    {
      id: invokeId(MessageToRoom.id, duckula.id),
      src: ctx => Mailbox.wrap(
        MessageToRoom.machine.withContext({
          ...MessageToRoom.initialContext(),
          actors: {
            wechaty: ctx.actors.wechaty,
          },
        }),
      ),
    },
  ],

  /**
   * Huan(202204): Global events must be internal / private
   *  or the Mailbox actor will be blocked.
   */
  on: {
    [duckula.Type.NOTICE]: {
      actions: actions.send(
        (_, e) => Notice.Event.NOTICE(
          '【注册系统】' + e.payload.text,
          e.payload.mentions,
        ),
        { to: invokeId(Notice.id, duckula.id) },
      ),
    },
    [duckula.Type.HELP]: {
      actions: [
        actions.send(
          ctx => duckula.Event.NOTICE(
            [
              '【帮助】',
              '【注册参会人员】',
              '请主席发送一条消息，同时一次性 @ 所有参会人员，即可完成参会活动人员注册。',
              `当前注册${Object.keys(ctx.attendees).length}人：`,
              Object.values(ctx.attendees).map(c => c.name).join(', '),
              '【注册分享主题】',
              '主席发送一条消息，一次性将分享主体、分享人、分享人简介、分享大纲，发送出来即可完成分享主题注册。',
              '...TBW',
            ].join(''),
            Object.keys(ctx.chairs),
          ),
        ),
      ],
    },
  },

  initial: duckula.State.Initializing,
  states: {
    [duckula.State.Initializing]: {
      entry: [
        actions.log(ctx => `states.Initializing.entry context ${JSON.stringify(ctx)}`, duckula.id),
        actions.send(duckula.Event.NOTICE('正在初始化...')),
      ],
      always: duckula.State.Initialized,
    },
    [duckula.State.Initialized]: {
      entry: actions.send(duckula.Event.NOTICE('初始化完成。')),
      always: duckula.State.Idle,
    },
    [duckula.State.Resetting]: {
      entry: [
        actions.log('states.Resetting.entry', duckula.id),
        actions.send(duckula.Event.NOTICE('重置中...')),
        actions.assign(ctx => ({
          ...ctx,
          ...duckula.initialContext(),
        })),
      ],
      always: duckula.State.Resetted,
    },
    [duckula.State.Resetted]: {
      entry: actions.send(duckula.Event.NOTICE('重置完成。')),
      always: duckula.State.Initializing,
    },

    /**
     * Idle
     *
     * 1. received REPORT   -> transition to Busy
     * 2. received RESET    -> transition to Resetting
     */
    [duckula.State.Idle]: {
      entry: [
        Mailbox.actions.idle(duckula.id),
      ],
      on: {
        '*'                   : duckula.State.Idle,
        [duckula.Type.REPORT] : duckula.State.Busy,
        [duckula.Type.RESET]  : duckula.State.Resetting,
      },
    },

    [duckula.State.Busy]: {
      always: duckula.State.RegisteringRoom,
    },

    [duckula.State.RegisteringRoom]: {
      entry: [
        actions.send(duckula.Event.VALIDATE()),
      ],
      on: {
        [duckula.Type.HELP]: {
          actions: actions.send(duckula.Event.NOTICE(
            '定位参会人员的活动群中... 在群内发送任意消息，完成活动群定位。',
          )),
        },
        [duckula.Type.MESSAGE]: {
          actions: actions.send((_, e) => e, { to: invokeId(MessageToRoom.id, duckula.id) }),
        },
        [duckula.Type.ROOM]: {
          actions: [
            actions.assign({ room: (_, e) => e.payload.room }),
            actions.send(duckula.Event.VALIDATE()),
          ],
        },
        [duckula.Type.VALIDATE]: {
          actions: [
            actions.choose<Context, any>([
              {
                cond: ctx => !!ctx.room,
                actions: [
                  actions.send(ctx => duckula.Event.NOTICE(
                    `活动群已经完成定位。设置为：${ctx.room?.topic}`,
                  )),
                  actions.send(duckula.Event.NEXT()),
                ],
              },
              { actions: actions.send(duckula.Event.HELP()) },
            ]),
          ],
        },
        [duckula.Type.NO_ROOM] : {
          actions: actions.send(duckula.Event.HELP()),
        },
        [duckula.Type.GERROR]  : duckula.State.Erroring,
        [duckula.Type.NEXT]    : duckula.State.RegisteringChairs,
      },
    },

    [duckula.State.RegisteringChairs]: {
      entry: [
        actions.send(duckula.Event.VALIDATE()),
      ],
      on: {
        [duckula.Type.HELP]: {
          actions: actions.send(
            ctx => duckula.Event.NOTICE(
              [
                '登记活动主席中... 在群内用一条消息 @ 主席，进行主席登记。',
                '锁定活动主席中... 在群内发送消息 @ 主席，完成主席锁定。',
                '每条消息登记一个主席。可以登记多个主席。',
                '完成所有主席登记完成后，发送 NEXT 指令（完成、下一步、/next），进入会议下一个议程。',
              ].join('\n'),
              Object.keys(ctx.chairs),
            ),
          ),
        },
        [duckula.Type.MESSAGE]: {
          actions: [
            actions.send((_, e) => e, { to: invokeId(MessageToMentions.id,  duckula.id) }),
            actions.send((_, e) => e, { to: invokeId(MessageToIntents.id,   duckula.id) }),
          ],
        },
        [duckula.Type.MENTIONS]: {
          actions: [
            actions.assign({
              chairs: (_, e) => e.payload.contacts.reduce((acc, cur) => ({ ...acc, [cur.id]: cur }), {}),
            }),
            actions.send((ctx, e) => duckula.Event.NOTICE(
              [
                `${e.payload.contacts[0].name} 成功登记为主席。`,
                `当前主席名单：${Object.values(ctx.chairs).map(c => c.name).join('、')}`,
                '如果有其他主席，清重复登记流程，发送消息进行登记。',
                '输入 NEXT 指令（完成、下一步、/next），进入下一个议程。',
              ].join('\n'),
              e.payload.message ? [ e.payload.message.talkerId ] : [],
            )),
          ],
        },
        [duckula.Type.INTENTS]: {
          actions: actions.choose([
            {
              cond: (_, e) => e.payload.intents.includes(Intent.Next),
              actions: actions.send(duckula.Event.VALIDATE()),
            },
            { actions: actions.send(duckula.Event.HELP()) },
          ]),
        },
        [duckula.Type.VALIDATE]: {
          actions: actions.choose<Context, any>([
            {
              cond: ctx => Object.keys(ctx.chairs).length > 0,
              actions: [
                actions.send(ctx => duckula.Event.NOTICE(
                  '主席锁定完成。主席名单：',
                  Object.keys(ctx.chairs),
                )),
                actions.send(duckula.Event.NEXT()),
              ],
            },
            { actions: actions.send(duckula.Event.HELP()) },
          ]),
        },
        [duckula.Type.NO_MENTION] : {
          actions: actions.send(duckula.Event.HELP()),
        },
        [duckula.Type.GERROR]     : duckula.State.Erroring,
        [duckula.Type.NEXT]       : duckula.State.RegisteringTalks,
      },
    },

    [duckula.State.RegisteringTalks]: {
      entry: [
        actions.send(duckula.Event.VALIDATE()),
      ],
      on: {
        [duckula.Type.HELP]: {
          actions: actions.send(
            ctx => duckula.Event.NOTICE(
              [
                '登记活动分享主题中... 在群内用一条消息发送演讲主题大纲，同时 @ 分享人，进行主题登记。',
                '每条消息登记一个主题。可以登记多个主题。',
                '完成所有主题登记完成后，发送 NEXT 指令（完成、下一步、/next），进入会议下一个议程。',
              ].join('\n'),
              Object.keys(ctx.chairs),
            ),
          ),
        },
        [duckula.Type.MESSAGE]: {
          actions: [
            actions.send((_, e) => e, { to: invokeId(MessageToMentions.id,  duckula.id) }),
            actions.send((_, e) => e, { to: invokeId(MessageToIntents.id,   duckula.id) }),
          ],
        },
        [duckula.Type.NO_MENTION]: {
          actions: actions.send(duckula.Event.HELP()),
        },
        [duckula.Type.MENTIONS]: {
          actions: [
            actions.assign({
              talks: (ctx, e) => ({
                ...ctx.talks,
                ...e.payload.message?.text
                  ? {
                      [e.payload.contacts[0].id]: e.payload.message.text,
                    }
                  : {},
              }),
            }),
            actions.send((_, e) => duckula.Event.NOTICE(
              [
                `${e.payload.contacts[0].name} 登记了演讲主题：${e.payload.message?.text}`,
                '如果有其他分享主题，清重复登记流程，发送消息进行登记。',
                '输入 NEXT 指令（完成、下一步、/next），进入下一个议程。',
              ].join('\n'),
              e.payload.message
                ? [ e.payload.message.talkerId ]
                : []
              ,
            )),
          ],
        },
        [duckula.Type.INTENTS]: {
          actions: actions.choose([
            {
              cond: (_, e) => e.payload.intents.includes(Intent.Next),
              actions: actions.send(duckula.Event.VALIDATE()),
            },
            { actions: actions.send(duckula.Event.HELP()) },
          ]),
        },
        [duckula.Type.VALIDATE]: {
          actions: actions.choose<Context, any>([
            {
              cond: ctx => Object.keys(ctx.talks).length > 0,
              actions: [
                actions.send(ctx => duckula.Event.NOTICE([
                  '分享主题完成登记：',
                  ...Object.values(ctx.talks),
                ].join('\n'))),
                actions.send(duckula.Event.NEXT()),
              ],
            },
            { actions: actions.send(duckula.Event.HELP()) },
          ]),
        },
        [duckula.Type.NEXT]   : duckula.State.RegisteringAttendees,
        [duckula.Type.GERROR] : duckula.State.Erroring,
      },
    },

    [duckula.State.RegisteringAttendees]: {
      entry: [
        actions.send(duckula.Event.VALIDATE()),
      ],
      on: {
        [duckula.Type.HELP]: {
          actions: actions.send(
            ctx => duckula.Event.NOTICE(
              [
                '注册沙龙活动成员中... 在群内用一条消息 @ 所有参与者，进行活动成员登记。',
                '请将所有参与沙龙的成员，在微信群中全部进行 @ 进行登记。（主席不必重复登记）',
                '完成所有沙龙活动成员登记后，发送 NEXT 指令（完成、下一步、/next），进入会议下一个议程。',
              ].join('\n'),
              Object.keys(ctx.chairs),
            ),
          ),
        },
        [duckula.Type.MESSAGE]: {
          actions: [
            actions.send((_, e) => e, { to: invokeId(MessageToMentions.id,  duckula.id) }),
            actions.send((_, e) => e, { to: invokeId(MessageToIntents.id,   duckula.id) }),
          ],
        },
        [duckula.Type.MENTIONS]: {
          actions: [
            actions.assign({
              attendees: (_, e) => e.payload.contacts.reduce((acc, cur) => ({ ...acc, [cur.id]: cur }), {}),
            }),
            actions.send((ctx, e) => duckula.Event.NOTICE(
              [
                `${e.payload.contacts.map(c => c.name).join('、')} 成功登记为沙龙活动成员。`,
                `当前沙龙活动成员名单：${Object.values(ctx.attendees).map(c => c.name).join('、')}`,
                '如果有其他沙龙活动成员需要登记，清重复登记流程，发送消息进行登记。',
                '输入 NEXT 指令（完成、下一步、/next），进入下一个议程。',
              ].join('\n'),
              Object.keys(ctx.chairs),
            )),
          ],
        },
        [duckula.Type.INTENTS]: {
          actions: actions.choose([
            {
              cond: (_, e) => e.payload.intents.includes(Intent.Next),
              actions: actions.send(duckula.Event.VALIDATE()),
            },
            { actions: actions.send(duckula.Event.HELP()) },
          ]),
        },
        [duckula.Type.VALIDATE]: {
          actions: actions.choose<Context, any>([
            {
              cond: ctx => Object.keys(ctx.chairs).length > 0,
              actions: [
                actions.send(ctx => duckula.Event.NOTICE(
                  '沙龙活动成员登记完成。名单：',
                  Object.keys(ctx.attendees),
                )),
                actions.send(duckula.Event.NEXT()),
              ],
            },
            { actions: actions.send(duckula.Event.HELP()) },
          ]),
        },
        [duckula.Type.NO_MENTION] : {
          actions: actions.send(duckula.Event.HELP()),
        },
        [duckula.Type.GERROR] : duckula.State.Erroring,
        [duckula.Type.NEXT]   : duckula.State.RegisteringTalks,
      },
    },

    [duckula.State.Summarizing]: {
      entry: [
        actions.log(
          ctx => [
            'states.Summarizing.entry ',
            `room/${ctx.room?.id} `,
            `chairs/${Object.keys(ctx.chairs).length} `,
            `talks/${Object.keys(ctx.talks).length} `,
            `attendees/${Object.keys(ctx.attendees).length} `,
          ].join(''),
          duckula.id,
        ),
        actions.send(ctx => duckula.Event.NOTICE(
          [
            '注册完成：',
            `主席：${Object.values(ctx.chairs).map(c => c.name).join('、')}，`,
            `成员：${Object.values(ctx.attendees).map(c => c.name).join('、')}（共${Object.keys({ ...ctx.chairs, ...ctx.attendees }).length}名成员参加活动）`,
            `议程：${Object.keys(ctx.talks).map(id => ctx.talks[id]).join('\n')}（共${Object.keys(ctx.talks).length}个议程）`,
          ].join('\n'),
        )),
        actions.send(duckula.Event.NEXT()),
      ],
      on: {
        [duckula.Type.NEXT]   : duckula.State.Reporting,
      },
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
        actions.log('states.Reporting.entry', duckula.id),
        Mailbox.actions.reply(ctx => duckula.Event.CHAIRS(Object.values(ctx.chairs))),
        Mailbox.actions.reply(ctx => duckula.Event.ATTENDEES(Object.values(ctx.attendees))),
        Mailbox.actions.reply(ctx => duckula.Event.TALKS(ctx.talks)),
      ],
      always: duckula.State.Idle,
    },

    ...responseStates(duckula.id),
  },
})

export default machine
