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
/**
 * Finite State Machine for BOT Friday Club Meeting
 *  @link https://github.com/wechaty/bot5-assistant
 */
import { createMachine, actions }   from 'xstate'
import * as Mailbox                 from 'mailbox'

import * as duck            from '../../duck/mod.js'

import * as NoticingDuckula         from '../noticing/mod.js'
import * as RegisterDuckula         from '../register/mod.js'
import * as BrainstormingDuckula    from '../brainstorming/mod.js'

import * as selectors                       from './selectors.js'
import duckula, { Context, Event, Events }  from './duckula.js'

const chairMessageToIntent = actions.choose<Context, Events['MESSAGE']>([
  {
    cond: (ctx, e) => e.payload.message.talkerId === selectors.chair(ctx)?.id,
    actions: intentAddress.send((_, e) => e),
  },
])

const nextIntentToNext = actions.choose<Context, Events['INTENTS']>([
  {
    cond: (_, e) => e.payload.intents.includes(duck.Intent.Next),
    actions: actions.send(duckula.Event.NEXT()),
  },
])

const machine = createMachine<
  Context,
  Event
>({
  id: duckula.id,
  on: {
    [duckula.Type.RESET]: {
      target: duckula.State.Resetting,
    },
    [NoticingDuckula.Type.NOTICE]: {
      actions: actions.send((_, e) => e, { to: ctx => ctx.address.noticing }),
    },
  },
  context: duckula.initialContext,
  initial: duckula.State.Initializing,
  states: {
    [duckula.State.Resetting]: {
      entry: [
        actions.log('duckula.State.Resetting.entry', duckula.id),
        actions.assign(_ => duckula.initialContext()),
        actions.send(duckula.Event.RESET(duckula.id), { to: ctx => ctx.address.register }),
        actions.send(duckula.Event.RESET(duckula.id), { to: ctx => ctx.address.feedback }),
        actions.send(duckula.Event.RESET(duckula.id), { to: ctx => ctx.address.brainstorming }),
        actions.send(NoticingDuckula.Event.NOTICE('【会议系统】重置中...')),
      ],
      always: duckula.State.Initializing,
    },
    [duckula.State.Initializing]: {
      always: duckula.State.Idle,
    },
    [duckula.State.Idle]: {
      entry: [
        actions.log('duckula.State.Idle.entry', duckula.id),
        Mailbox.actions.idle(duckula.id)('idle'),
      ],
      on: {
        '*': duckula.State.Idle, // enforce external transision
        [duckula.Type.REPORT]: duckula.State.Reporting,
        [duckula.Type.ROOM]: {
          actions: [
            actions.send((_, e) => NoticingDuckula.Event.CONVERSATION(e.payload.room.id)),
            actions.assign({
              room: (_, e) => e.payload.room,
            }),
          ],
        },
        [duckula.Type.ATTENDEES]: {
          actions: [
            actions.send((_, e) => e, { to: ctx => ctx.address.register }),
            actions.assign({
              attendees: (_, e) => e.payload.contacts.reduce((acc, cur) => ({ ...acc, [cur.id]: cur }), {}),
            }),
          ],
        },
        [duckula.Type.CHAIRS]: {
          actions: [
            actions.assign({
              chairs: (_, e) => e.payload.contacts,
            }),
          ],
        },
      },
    },

    [duckula.State.Reporting]: {
      entry: [
        actions.choose<Context, Events['REPORT']>([
          {
            cond: ctx => !!ctx.minutes,
            actions: [
              Mailbox.actions.reply(ctx =>
                duckula.Event.MINUTE(ctx.minutes!),
              ),
              actions.send(duckula.Event.NEXT()),
            ],
          },
          {
            actions: [
              actions.send(duckula.Event.PROCESS()),
            ],
          },
        ]),
      ],
      on: {
        [duckula.Type.NEXT]:     duckula.State.Idle,
        [duckula.Type.PROCESS]:  duckula.State.Processing,
      },
    },
    [duckula.State.Processing]: {
    },
    /**
     *
     * BOT Friday Club - Chair Manual
     *  @link http://bot5.ml/manuals/chair/
     *
    */
    [duckula.State.Announcing]: {
      entry: [
        actions.send(NoticingDuckula.Event.NOTICE([
          `
Bot Friday (as known as BOT5) is a CLUB for chatbot builders and entrepreneurs with all the topics about the chatbot.
BOT Friday Club 是一个技术极客讨论聊天机器人行业落地和商业应用的创业论坛。

Our members are coming from:

- Developers
- Entrepreneurs
- Giant company product managers

The topic is all about:

- Technology
- Ecosystem
- Business

We have meetups every week, on Friday night.

Learn more about BOT Friday Club: https://bot5.ml/
          `,
          '【会议系统】本周 BOT Friday Club 活动通知：',
          '公布时间地点分享人和主题',
          'tbw',
        ].join(''))),
      ],
      always: duckula.State.Retrospecting,
    },
    [duckula.State.Retrospecting]: {
      entry: [
        actions.send(NoticingDuckula.Event.NOTICE([
          '【会议系统】',
          '进入新环节：由轮值主席做最后一次活动回顾',
          '下一个环节：新人自我介绍',
        ].join(''))),
      ],
      on: {
        [duckula.Type.MESSAGE]: {
          actions: messageToIntents,
        },
        [duckula.Type.INTENTS]: {
          actions: [
            nextIntentToNext,
          ],
        },
        [duckula.Type.NEXT]: duckula.State.Joining,
      },
    },
    [duckula.State.Joining]: {
      entry: [
        actions.send(NoticingDuckula.Event.NOTICE([
          '【会议系统】',
          '正在进行：新人入群',
          '即将进行：新人自我介绍',
          '-------',
          '环节说明：将新人邀请进入 “Bot Friday Open Form - BFOF” 微信群。（邀请人负责邀请。如果邀请人不在现场则由主席一人负责）',
          '环节结束标志：所有新人完成加入微信群',
          '人工反馈：请主席确认所有新人已经入群完成后，输入“/next”，进入下一个环节。',
        ].join(''))),
      ],
      exit: [
        actions.send(NoticingDuckula.Event.NOTICE([
          '【会议系统】',
          '已经完成：新人入群',
          '即将开始：新人自我介绍',
        ].join(''))),
      ],
      on: {
        [duckula.Type.MESSAGE]: {
          actions: [
            chairMessageToIntent,
          ],
        },
        [duckula.Type.INTENTS]: {
          actions: [
            nextIntentToNext,
          ],
        },
        [duckula.Type.NEXT]: duckula.State.Introducing,
      },
    },
    [duckula.State.Introducing]: {
      entry: [
        actions.send(NoticingDuckula.Event.NOTICE([
          '【会议系统】',
          '当前环节：新人自我介绍',
          '即将进行：活动成员注册',
          '-------',
          '环节说明：通过微信语音发布在微信群中，1 MIN',
          '环节结束标志：所有新人完成自我介绍语音发送',
          '人工反馈：请主席确认所有新人已经介绍完成后，输入“/next”，进入下一个环节。',
        ].join(''))),
      ],
      exit: [
        actions.send(NoticingDuckula.Event.NOTICE([
          '【会议系统】',
          '已经完成：新人自我介绍',
          '即将开始：活动成员注册',
        ].join(''))),
      ],
      on: {
        [duckula.Type.MESSAGE]: {
          actions: [
            chairMessageToIntent,
          ],
        },
        [duckula.Type.INTENTS]: {
          actions: [
            nextIntentToNext,
          ],
        },
        [duckula.Type.NEXT]: duckula.State.Registering,
      },
    },
    [duckula.State.Registering]: {
      entry: [
        actions.send(RegisterDuckula.Event.REPORT(), { to: ctx => ctx.address.register }),
        actions.send(NoticingDuckula.Event.NOTICE([
          '【会议系统】',
          '当前模块：活动成员注册',
          '下一模块：主题分享',
          '--------',
          '未来的注册将结合GitHub评论回复报名',
        ].join(''))),
      ],
      exit: [
        actions.send(NoticingDuckula.Event.NOTICE([
          '【会议系统】',
          '已完成当前模块：活动成员注册',
          '准备进入下一模块：主题分享',
        ].join(''))),
      ],
      on: {
        [duckula.Type.MESSAGE]: {
          actions: actions.send((_, e) => e, { to: ctx => ctx.address.register }),
        },
        [duckula.Type.CONTACTS]: {
          actions: [
            actions.log((_, e) => `duckula.State.registering.on.CONTACTS ${e.payload.contacts.join(',')}`, duckula.id),
            actions.assign({
              attendees: (_, e) => e.payload.contacts.reduce((acc, cur) => ({ ...acc, [cur.id]: cur }), {}),
            }),
            actions.send(duckula.Event.NEXT()),
          ],
        },
        [duckula.Type.BACK]: duckula.State.Introducing,
        [duckula.Type.NEXT]: duckula.State.Presenting,
      },
    },
    [duckula.State.Presenting]: {
      entry: [
        actions.send(NoticingDuckula.Event.NOTICE([
          '【会议系统】',
          '当前模块：主题分享',
          '后续模块：会员升级',
          '-------',
          '模块说明：展开本次活动内容（主席可根据情况酌情修改）：分享者 (<30min, 不可以超过 45 mins，超时后每一分钟需要发￥10红包到会员群)',
          '环节结束标志：所有分享者完成分享后，主席输入“/next”可进入下一个环节。',
        ].join(''))),
      ],
      on: {
        [duckula.Type.MESSAGE]: {
          actions: [
            chairMessageToIntent,
          ],
        },
        [duckula.Type.INTENTS]: {
          actions: [
            nextIntentToNext,
          ],
        },
        [duckula.Type.BACK]: duckula.State.Registering,
        [duckula.Type.NEXT]: duckula.State.Registering,
      },
    },
    [duckula.State.Upgrading]: {
      entry: [
        actions.send(NoticingDuckula.Event.NOTICE([
          '【会议系统】',
          '新人 -> 实习会员：第一次完成分享的新人，将升级为实习会员。由其邀请人负责将其加入 “Bot Friday Club - BOT5” 会员群。（如果邀请人不在，则由当期主席负责）；',
          '实习会员 -> 正式会员：参加了三次活动的实习会员（含三次），将有资格转为正式会员。转正要求：发送个人 Profile 页面的 Pull Request 至 https://bot5.ml/people/GITHUB_USERNAME/ 下。PR Merge 后正式成为 BOT5 会员；',
          '正式会员 -> 实习主席：正式会员可以被提名成为主席候选人。主席候选人被选举成功之后，成为实习主席；',
          '实习主席 -> 主席：将完成了第一次轮值主席工作的实习主席，加入 Github Team: chairs，并在 team 中授予 maintainer 权限，便于未来升级其他主席。',
        ].join(''))),
      ],
      always: duckula.State.Brainstorming,
    },
    [duckula.State.Brainstorming]: {
      entry: [
        actions.send(NoticingDuckula.Event.NOTICE([
          '【会议系统】脑洞拓展：',
          '正在进行：头脑风暴',
          '准备进行：主席任命',
          '分享自己在本次活动上想到的新的好点子(1 MIN per person)',
          '不讨论（讨论留到After Party）',
        ].join(''))),
        actions.send(BrainstormingDuckula.Event.REPORT(), { to: ctx => ctx.address.brainstorming }),
      ],
      exit: [
        actions.send(NoticingDuckula.Event.NOTICE([
          '【会议系统】',
          '已经完成：头脑风暴',
          '即将开始：主席任命',
        ].join(''))),
      ],
      on: {
        [duckula.Type.MESSAGE]: {
          actions: actions.send((_, e) => e, { to: ctx => ctx.address.brainstorming }),
        },
        [duckula.Type.FEEDBACKS]: {
          actions: [
            actions.log((_, e) => `duckula.State.brainstorming.on.FEEDBACKS total/${Object.values(e.payload.feedbacks).length}`, duckula.id),
            actions.assign({
              brainstorms: (_, e) => e.payload.feedbacks,
            }),
            actions.send(duckula.Event.NEXT()),
          ],
        },
        [duckula.Type.BACK]: duckula.State.Upgrading,
        [duckula.Type.NEXT]: duckula.State.Electing,
      },
    },
    [duckula.State.Electing]: {
      entry: [
        actions.send(NoticingDuckula.Event.NOTICE([
          '【会议系统】选举主席：',
          '选出下下任轮值主席、副主席人选，并举行“受蛋仪式”（主席和副主席不允许挂靠，副主席需要参加主席场次的活动）',
          '将金色计时器移交给下任主席，并由下任主席负责妥善保管',
          '将银色计时器移交给下任副主席，并由下任副主席负责妥善保管',
        ].join(''))),
      ],
      always: duckula.State.Upgrading,
    },
    [duckula.State.Elected]: {
      entry: [
        actions.send(NoticingDuckula.Event.NOTICE([
          '【会议系统】本次活动轮值主席、下次轮值主席、下次轮值副主席合影',
        ].join(''))),
      ],
      always: duckula.State.Roasting,
    },
    [duckula.State.Roasting]: {
      entry: [
        actions.send(NoticingDuckula.Event.NOTICE([
          '【会议系统】吐槽环节尚未支持，请下次活动再试。（自动跳转到下一步）',
          '参会人员每人至少指出一条如何在未来可以将活动办的更好的意见建议（1 MIN per person）',
          '不讨论（讨论留到After Party）',
          '主席负责记录',
        ].join(''))),
      ],
      always: duckula.State.Summarizing,
    },
    [duckula.State.Summarizing]: {
      entry: [
        actions.send(NoticingDuckula.Event.NOTICE(
          '【会议系统】summarizing 轮值主席发言，做活动总结',
        )),
      ],
      always: duckula.State.Summarized,
    },
    [duckula.State.Pledging]: {
      entry: [
        actions.send(NoticingDuckula.Event.NOTICE(
          '【会议系统】轮值副主席述职报告：陈述自己下周作为主席的主要工作内容',
        )),
      ],
      always: duckula.State.Photoing,
    },
    [duckula.State.Photoing]: {
      entry: [
        actions.send(NoticingDuckula.Event.NOTICE([
          '【会议系统】合影',
          'photoing 所有参会人员合影（原图经过脸盲助手发到会员群，并将带名字的照片，发布在活动纪要中）',
        ].join(''))),
      ],
      always: duckula.State.Housekeeping,
    },
    [duckula.State.Housekeeping]: {
      entry: [
        actions.send(NoticingDuckula.Event.NOTICE([
          '【会议系统】场地复原',
          '轮值主席组织大家将场地复原（桌椅、白板、设备等）',
        ].join(''))),
      ],
      always: duckula.State.Chatting,
    },
    [duckula.State.Chatting]: {
      entry: [
        actions.send(NoticingDuckula.Event.NOTICE([
          '【会议系统】活动结束，自由交流',
          '下一环节：After Party',
          '(Drinking, AA)',
        ].join(''))),
      ],
      always: duckula.State.Drinking,
    },
    [duckula.State.Drinking]: {
      entry: [
        actions.send(NoticingDuckula.Event.NOTICE(
          '【会议系统】活动结束，自由交流',
        )),
      ],
      always: duckula.State.Finishing,
    },
    [duckula.State.Finishing]: {
      entry: [
        actions.send(NoticingDuckula.Event.NOTICE([
          '【会议系统】After Party结束，请美食主席把账单发到群里大家AA',
          '感谢各位参与BOT Friday Club沙龙活动，大家下次再见！',
        ].join(''))),
      ],
      always: duckula.State.Finished,
    },
  },
})

export default machine
