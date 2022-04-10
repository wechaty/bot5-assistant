/* eslint-disable sort-keys */
/**
 * Finite State Machine for BOT Friday Club Meeting
 *  @link https://github.com/wechaty/bot5-assistant
 */
import { createMachine, actions }   from 'xstate'
import * as Mailbox                 from 'mailbox'

import { InjectionToken }   from '../ioc/tokens.js'
import * as duck            from '../duck/mod.js'

import * as actors from './mod.js'

const Type = {
  IDLE   : duck.Type.IDLE,
  RESET: duck.Type.RESET,
  REPORT: duck.Type.REPORT,
  ROOM: duck.Type.ROOM,
  ATTENDEES: duck.Type.ATTENDEES,
  CHAIRS: duck.Type.CHAIRS,
  PROCESS: duck.Type.PROCESS,
  MESSAGE: duck.Type.MESSAGE,
  FEEDBACKS: duck.Type.FEEDBACKS,
  BACK: duck.Type.BACK,
  NEXT: duck.Type.NEXT,
  INTENTS: duck.Type.INTENTS,
  CONTACTS: duck.Type.CONTACTS,
} as const

// eslint-disable-next-line no-redeclare
type Type = typeof Type[keyof typeof Type]

const Event = {
  START: duck.Event.START,
  CANCEL: duck.Event.CANCEL,
  FINISH: duck.Event.FINISH,
  REPORT: duck.Event.REPORT,
  IDLE: duck.Event.IDLE,
  PROCESS: duck.Event.PROCESS,
  ROOM: duck.Event.ROOM,
  MESSAGE: duck.Event.MESSAGE,
  CONTACTS: duck.Event.CONTACTS,
  BACK: duck.Event.BACK,
  NEXT: duck.Event.NEXT,
  NOTICE: duck.Event.NOTICE,
  ATTENDEES: duck.Event.ATTENDEES,
  CHAIRS: duck.Event.CHAIRS,
  RESET: duck.Event.RESET,
  INTENTS: duck.Event.INTENTS,
  MINUTE: duck.Event.MINUTE,
  FEEDBACKS: duck.Event.FEEDBACKS,
}

// eslint-disable-next-line no-redeclare
type Event = {
  [key in keyof typeof Event]: ReturnType<typeof Event[key]>
}

const State = {
  initializing: duck.State.initializing,
  Idle: duck.State.Idle,
  mentioning: duck.State.mentioning,
  upgrading: duck.State.upgrading,
  brainstorming: duck.State.brainstorming,
  resetting: duck.State.resetting,
  registering: duck.State.registering,
  electing: duck.State.electing,
  elected: duck.State.elected,
  reporting: duck.State.reporting,
  processing: duck.State.processing,
  announcing: duck.State.announcing,
  presenting: duck.State.presenting,
  introducing: duck.State.introducing,
  summarizing:  duck.State.summarizing,
  pledging:  duck.State.pledging,
  photoing:  duck.State.photoing,
  housekeeping:  duck.State.housekeeping,
  chatting:  duck.State.chatting,
  retrospecting: duck.State.retrospecting,
  joining: duck.State.joining,
  roasting: duck.State.roasting,
  summarized: duck.State.summarized,
  finishing: duck.State.finishing,
  drinking:  duck.State.drinking,
} as const

// eslint-disable-next-line no-redeclare
type State = typeof State[keyof typeof State]

interface Context {
  minutes?: string
  room?: string
  attendees: string[]
  chairs: string[]
  brainstorms: {
    [key: string]: string,
  }
}

function initialContext (): Context {
  const context: Context = {
    minutes: undefined,
    room: undefined,
    attendees: [],
    chairs: [],
    brainstorms: {},
  }
  return JSON.parse(JSON.stringify(context))
}

const ctxChair      = (ctx: Context) => ctx.chairs[0]
const ctxViceChairs = (ctx: Context) => ctx.chairs.slice(1)

const MACHINE_NAME = 'MeetingMachine'

const machineFactory = (
  noticeAddress        : Mailbox.Address,
  registerAddress      : Mailbox.Address,
  feedbackAddress      : Mailbox.Address,
  brainstormingAddress : Mailbox.Address,
  intentAddress : Mailbox.Address,
) => {
  const say = (...texts: string[]) =>
    noticeAddress.send(
      Event.NOTICE(
        texts.join('\n'),
      ),
    )

  const chairMessageToIntent = actions.choose<Context, Event['MESSAGE']>([
    {
      cond: (ctx, e) => e.payload.message.talker().id === ctxChair(ctx),
      actions: intentAddress.send((_, e) => e),
    },
  ])

  const nextIntentToNext = actions.choose<Context, Event['INTENTS']>([
    {
      cond: (_, e) => e.payload.intents.includes(duck.Intent.Next),
      actions: actions.send(Event.NEXT()),
    },
  ])

  const machine = createMachine<
    Context,
    Event[keyof Event]
  >({
    id: MACHINE_NAME,
    context: () => initialContext(),
    initial: State.initializing,
    on: {
      [Type.RESET]: {
        target: State.resetting,
      },
    },
    states: {
      [State.resetting]: {
        entry: [
          actions.log('State.resetting.entry', MACHINE_NAME),
          actions.assign(_ => initialContext()),
          actions.send(Event.RESET(MACHINE_NAME), { to: String(registerAddress) }),
          actions.send(Event.RESET(MACHINE_NAME), { to: String(feedbackAddress) }),
          actions.send(Event.RESET(MACHINE_NAME), { to: String(brainstormingAddress) }),
          noticeAddress.send(actors.notice.Events.NOTICE('【会议系统】重置中...')),
        ],
        always: State.initializing,
      },
      [State.initializing]: {
        always: State.Idle,
      },
      [State.Idle]: {
        entry: [
          actions.log('State.Idle.entry', MACHINE_NAME),
          Mailbox.actions.idle(MACHINE_NAME)('idle'),
        ],
        on: {
          '*': State.Idle, // enforce external transision
          [Type.REPORT]: State.reporting,
          [Type.ROOM]: {
            actions: [
              noticeAddress.send((_, e) => actors.notice.Events.CONVERSATION(e.payload.room)),
              actions.assign({
                room: (_, e) => e.payload.room,
              }),
            ],
          },
          [Type.ATTENDEES]: {
            actions: [
              registerAddress.send((_, e) => e),
              actions.assign({
                attendees: (_, e) => e.payload.contacts,
              }),
            ],
          },
          [Type.CHAIRS]: {
            actions: [
              actions.assign({
                chairs: (_, e) => e.payload.contacts,
              }),
            ],
          },
        },
      },
      [State.reporting]: {
        entry: [
          actions.choose<Context, Event>([
            {
              cond: ctx => !!ctx.minutes,
              actions: [
                Mailbox.actions.reply(ctx =>
                  Event.MINUTE(ctx.minutes!),
                ),
                actions.send(Event.IDLE()),
              ],
            },
            {
              actions: [
                actions.send(Event.PROCESS()),
              ],
            },
          ]),
        ],
        on: {
          [Type.IDLE]:     State.Idle,
          [Type.PROCESS]:  State.processing,
        },
      },
      [State.processing]: {
      },
      /**
       *
       * BOT Friday Club - Chair Manual
       *  @link http://bot5.ml/manuals/chair/
       *
      */
      [State.announcing]: {
        entry: [
          say(
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
          ),
        ],
        always: State.retrospecting,
      },
      [State.retrospecting]: {
        entry: [
          say(
            '【会议系统】',
            '进入新环节：由轮值主席做最后一次活动回顾',
            '下一个环节：新人自我介绍',
          ),
        ],
        on: {
          [Type.MESSAGE]: {
            actions: messageToIntents,
          },
          [Type.INTENTS]: {
            actions: [
              nextIntentToNext,
            ],
          },
          [Type.NEXT]: State.joining,
        },
      },
      [State.joining]: {
        entry: [
          say(
            '【会议系统】',
            '正在进行：新人入群',
            '即将进行：新人自我介绍',
            '-------',
            '环节说明：将新人邀请进入 “Bot Friday Open Form - BFOF” 微信群。（邀请人负责邀请。如果邀请人不在现场则由主席一人负责）',
            '环节结束标志：所有新人完成加入微信群',
            '人工反馈：请主席确认所有新人已经入群完成后，输入“/next”，进入下一个环节。',
          ),
        ],
        exit: [
          say(
            '【会议系统】',
            '已经完成：新人入群',
            '即将开始：新人自我介绍',
          ),
        ],
        on: {
          [Type.MESSAGE]: {
            actions: [
              chairMessageToIntent,
            ],
          },
          [Type.INTENTS]: {
            actions: [
              nextIntentToNext,
            ],
          },
          [Type.NEXT]: State.introducing,
        },
      },
      [State.introducing]: {
        entry: [
          say(
            '【会议系统】',
            '当前环节：新人自我介绍',
            '即将进行：活动成员注册',
            '-------',
            '环节说明：通过微信语音发布在微信群中，1 MIN',
            '环节结束标志：所有新人完成自我介绍语音发送',
            '人工反馈：请主席确认所有新人已经介绍完成后，输入“/next”，进入下一个环节。',
          ),
        ],
        exit: [
          say(
            '【会议系统】',
            '已经完成：新人自我介绍',
            '即将开始：活动成员注册',
          ),
        ],
        on: {
          [Type.MESSAGE]: {
            actions: [
              chairMessageToIntent,
            ],
          },
          [Type.INTENTS]: {
            actions: [
              nextIntentToNext,
            ],
          },
          [Type.NEXT]: State.registering,
        },
      },
      [State.registering]: {
        entry: [
          registerAddress.send(Event.REPORT()),
          say(
            '【会议系统】',
            '当前模块：活动成员注册',
            '下一模块：主题分享',
            '--------',
            '未来的注册将结合GitHub评论回复报名',
          ),
        ],
        exit: [
          say(
            '【会议系统】',
            '已完成当前模块：活动成员注册',
            '准备进入下一模块：主题分享',
          ),
        ],
        on: {
          [Type.MESSAGE]: {
            actions: registerAddress.send((_, e) => e),
          },
          [Type.CONTACTS]: {
            actions: [
              actions.log((_, e) => `State.registering.on.CONTACTS ${e.payload.contacts.join(',')}`, MACHINE_NAME),
              actions.assign({
                attendees: (_, e) => e.payload.contacts,
              }),
              actions.send(Event.NEXT()),
            ],
          },
          [Type.BACK]: State.introducing,
          [Type.NEXT]: State.presenting,
        },
      },
      [State.presenting]: {
        entry: [
          say(
            '【会议系统】',
            '当前模块：主题分享',
            '后续模块：会员升级',
            '-------',
            '模块说明：展开本次活动内容（主席可根据情况酌情修改）：分享者 (<30min, 不可以超过 45 mins，超时后每一分钟需要发￥10红包到会员群)',
            '环节结束标志：所有分享者完成分享后，主席输入“/next”可进入下一个环节。',
          ),
        ],
        on: {
          [Type.MESSAGE]: {
            actions: [
              chairMessageToIntent,
            ],
          },
          [Type.INTENTS]: {
            actions: [
              nextIntentToNext,
            ],
          },
          [Type.BACK]: State.registering,
          [Type.NEXT]: State.registering,
        },
      },
      [State.upgrading]: {
        entry: [
          say(
            '【会议系统】',
            '新人 -> 实习会员：第一次完成分享的新人，将升级为实习会员。由其邀请人负责将其加入 “Bot Friday Club - BOT5” 会员群。（如果邀请人不在，则由当期主席负责）；',
            '实习会员 -> 正式会员：参加了三次活动的实习会员（含三次），将有资格转为正式会员。转正要求：发送个人 Profile 页面的 Pull Request 至 https://bot5.ml/people/GITHUB_USERNAME/ 下。PR Merge 后正式成为 BOT5 会员；',
            '正式会员 -> 实习主席：正式会员可以被提名成为主席候选人。主席候选人被选举成功之后，成为实习主席；',
            '实习主席 -> 主席：将完成了第一次轮值主席工作的实习主席，加入 Github Team: chairs，并在 team 中授予 maintainer 权限，便于未来升级其他主席。',
          ),
        ],
        always: State.brainstorming,
      },
      [State.brainstorming]: {
        entry: [
          say(
            '【会议系统】脑洞拓展：',
            '正在进行：头脑风暴',
            '准备进行：主席任命',
            '分享自己在本次活动上想到的新的好点子(1 MIN per person)',
            '不讨论（讨论留到After Party）',
          ),
          brainstormingAddress.send(Event.REPORT()),
        ],
        exit: [
          say(
            '【会议系统】',
            '已经完成：头脑风暴',
            '即将开始：主席任命',
          ),
        ],
        on: {
          [Type.MESSAGE]: {
            actions: brainstormingAddress.send((_, e) => e),
          },
          [Type.FEEDBACKS]: {
            actions: [
              actions.log((_, e) => `State.brainstorming.on.FEEDBACKS total/${Object.values(e.payload.feedbacks).length}`, MACHINE_NAME),
              actions.assign({
                brainstorms: (_, e) => e.payload.feedbacks,
              }),
              actions.send(Event.NEXT()),
            ],
          },
          [Type.BACK]: State.upgrading,
          [Type.NEXT]: State.electing,
        },
      },
      [State.electing]: {
        entry: [
          say(
            '【会议系统】选举主席：',
            '选出下下任轮值主席、副主席人选，并举行“受蛋仪式”（主席和副主席不允许挂靠，副主席需要参加主席场次的活动）',
            '将金色计时器移交给下任主席，并由下任主席负责妥善保管',
            '将银色计时器移交给下任副主席，并由下任副主席负责妥善保管',
          ),
        ],
        always: State.upgrading,
      },
      [State.elected]: {
        entry: [
          say(
            '【会议系统】本次活动轮值主席、下次轮值主席、下次轮值副主席合影',
          ),
        ],
        always: State.roasting,
      },
      [State.roasting]: {
        entry: [
          say(
            '【会议系统】吐槽环节尚未支持，请下次活动再试。（自动跳转到下一步）',
            '参会人员每人至少指出一条如何在未来可以将活动办的更好的意见建议（1 MIN per person）',
            '不讨论（讨论留到After Party）',
            '主席负责记录',
          ),
        ],
        always: State.summarizing,
      },
      [State.summarizing]: {
        entry: [
          say(
            '【会议系统】summarizing 轮值主席发言，做活动总结',
          ),
        ],
        always: State.summarized,
      },
      [State.pledging]: {
        entry: [
          say(
            '【会议系统】轮值副主席述职报告：陈述自己下周作为主席的主要工作内容',
          ),
        ],
        always: State.photoing,
      },
      [State.photoing]: {
        entry: [
          say(
            '【会议系统】合影',
            'photoing 所有参会人员合影（原图经过脸盲助手发到会员群，并将带名字的照片，发布在活动纪要中）',
          ),
        ],
        always: State.housekeeping,
      },
      [State.housekeeping]: {
        entry: [
          say(
            '【会议系统】场地复原',
            '轮值主席组织大家将场地复原（桌椅、白板、设备等）',
          ),
        ],
        always: State.chatting,
      },
      [State.chatting]: {
        entry: [
          say(
            '【会议系统】活动结束，自由交流',
            '下一环节：After Party',
            '(Drinking, AA)',
          ),
        ],
        always: State.drinking,
      },
      [State.drinking]: {
        entry: [
          say(
            '【会议系统】活动结束，自由交流',
          ),
        ],
        always: State.finishing,
      },
      [State.finishing]: {
        entry: [
          say(
            '【会议系统】After Party结束，请美食主席把账单发到群里大家AA',
            '感谢各位参与BOT Friday Club沙龙活动，大家下次再见！',
          ),
        ],
        always: State.finishing,
      },
    },
  })

  return machine
}

mailboxFactory.inject = [
  InjectionToken.Logger,
  InjectionToken.NoticeMailbox,
] as const

function mailboxFactory (
  logger: Mailbox.Options['logger'],
  noticeMailbox: Mailbox.Interface,
) {
  const machine = machineFactory(
    noticeMailbox.address,
  )

  const mailbox = Mailbox.from(machine, { logger })
  return mailbox
}

export {
  type Context,
  machineFactory,
  mailboxFactory,
  Event as Events,
}
