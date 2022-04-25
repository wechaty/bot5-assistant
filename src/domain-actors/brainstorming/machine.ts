/* eslint-disable sort-keys */
import { actions, createMachine }   from 'xstate'
import * as Mailbox                 from 'mailbox'

import * as NoticingActor from '../noticing/mod.js'
import * as RegisterActor from '../register/mod.js'

import duckula, { Context, Event }    from './duckula.js'
import * as selectors                 from './selectors.js'

const machine = createMachine<Context, Event>({
  id: duckula.id,
  context: duckula.initialContext,
  initial: duckula.State.Initializing,
  on: {
    // '*': States.idle, // external transision is required by Mailbox Actor to work
    [duckula.Type.RESET]: duckula.State.Resetting,
    [duckula.Type.NOTICE]: {
      actions: [
        actions.log((_, e) => `on.NOTICE ${e.payload.notice}`, duckula.id),
        actions.send((ctx, e) => NoticingActor.Event.NOTICE(
          [
            '【脑爆系统】叮！系统检测到通知，请注意查收！',
            '-------',
            e.payload.notice,
          ].join('\n'),
          Object.values(ctx.contacts).map(c => c.id),
        )),
      ],
    },
    [duckula.Type.INTRODUCE]: {
      actions: [
        actions.log('on.INTRODUCE', duckula.id),
        actions.send(ctx => NoticingActor.Event.NOTICE(
          `
            头脑风暴环节：每位参会者按照报名确认顺序，在 BOT Friday Club 微信群中，通过“按住说话”功能，把自己在活动中得到的新点子与大家分享。
            当前主席：${Object.values(ctx.chairs).map(c => c.name).join('，')}
            当前参会者：${Object.values(ctx.contacts).map(c => c.name).join('，')}
            已经完成头脑风暴的参会者：${Object.keys(ctx.feedbacks).map(c => ctx.contacts[c]?.name).join('，')}
            还没有完成头脑风暴的参会者：${Object.values(ctx.contacts).filter(c => !ctx.feedbacks[c.id]).map(c => c.name).join('，')}
          `,
          Object.values(ctx.contacts).map(c => c.id),
        )),
      ],
    },
  },
  preserveActionOrder: true,
  states: {
    [duckula.State.Initializing]: {
      entry: [
        actions.log('state.initializing.entry', duckula.id),
      ],
      always: duckula.State.Idle,
    },
    [duckula.State.Resetting]: {
      entry: [
        actions.log('state.resetting.entry', duckula.id),
        actions.assign(_ => duckula.initialContext()),
      ],
      always: duckula.State.Initializing,
    },
    [duckula.State.Idle]: {
      entry: [
        actions.log('state.Idle.entry', duckula.id),
        Mailbox.actions.idle(duckula.id)('idle'),
      ],
      on: {
        [duckula.Type.REPORT]: {
          target: duckula.State.Reporting,
        },
        [duckula.Type.ROOM]: {
          actions: actions.assign({ room: (_, e) => e.payload.room }),
          target: duckula.State.Idle,
        },
      },
    },
    [duckula.State.Reporting]: {
      entry: [
        actions.log(ctx => `state.reporting.entry feedbacks(${selectors.feedbacksNum(ctx)})`, duckula.id),
        actions.choose<Context, any>([
          {
            cond: ctx => selectors.feedbacksNum(ctx) > 0,
            actions: [
              actions.log('state.reporting.entry -> [FEEDBACKS], [IDLE]', duckula.id),
              Mailbox.actions.reply(ctx => duckula.Event.FEEDBACKS(ctx.feedbacks)),
              actions.send(duckula.Event.IDLE()),
            ],
          },
          {
            actions: [
              actions.log('state.reporting.entry -> [PROCESS]', duckula.id),
              actions.send(duckula.Event.PROCESS()),
            ],
          },
        ]),
      ],
      on: {
        [duckula.Type.IDLE]:     duckula.State.Idle,
        [duckula.Type.PROCESS]:  duckula.State.Processing,
      },
    },
    [duckula.State.Processing]: {
      entry: [
        actions.log('state.processing.entry', duckula.id),
      ],
      always: [
        {
          cond: ctx => selectors.contactsNum(ctx) <= 0,
          target: duckula.State.Registering,
        },
        {
          cond: ctx => selectors.feedbacksNum(ctx) < selectors.contactsNum(ctx),
          target: duckula.State.Feedbacking,
        },
        {
          actions: [
            actions.send(ctx => NoticingActor.Event.NOTICE(
              '【脑爆系统】叮！系统检测到您已经成功完成头脑风暴，恭喜宿主！',
              Object.values(ctx.contacts).map(c => c.id),
            )),
          ],
          target: duckula.State.Reporting,
        },
      ],
    },
    [duckula.State.Registering]: {
      entry: [
        actions.log('state.Registering.entry', duckula.id),
        actions.send(RegisterActor.Event.REPORT(), { to: ctx => ctx.address.register }),
      ],
      on: {
        /**
         * Forward [MESSAGE] to RegisterActor
         */
        [duckula.Type.MESSAGE]: {
          actions: actions.send((_, e) => e, { to: ctx => ctx.address.register }),
        },
        /**
         * Accept [CONTACTS] from RegisterActor
         */
        [duckula.Type.CONTACTS]: {
          actions: [
            actions.log((_, e) => `state.Registering.on.CONTACTS ${e.payload.contacts.map(c => `@${c.name}`).join(' ')}`, duckula.id),
            actions.assign({
              contacts: (_, e) => e.payload.contacts.reduce(
                (acc, cur) => ({
                  ...acc,
                  [cur.id]: cur,
                }),
                {},
              ),
            }),
            actions.send(duckula.Event.NEXT()),
          ],
        },
        [duckula.Type.NEXT]: duckula.State.Registered,
      },
    },
    [duckula.State.Feedbacking]: {
      entry: [
        actions.log('state.Feedbacking.entry', duckula.id),
        actions.send(RegisterActor.Event.REPORT(), { to: ctx => ctx.address.feedback }),
      ],
      on: {
        /**
         * Forward [MESSAGE] to FeedbackActor
         */
        [duckula.Type.MESSAGE]: {
          actions: actions.send((_, e) => e, { to: ctx => ctx.address.feedback }),
        },
        /**
         * Accept [FEEDBACKS] from FeedbackActor
         */
        [duckula.Type.FEEDBACKS]: {
          actions: [
            actions.assign({ feedbacks: (_, e) => e.payload.feedbacks }),
            actions.send(duckula.Event.NEXT()),
          ],
        },
        [duckula.Type.NEXT]: duckula.State.Feedbacked,
      },
    },
    [duckula.State.Registered]: {
      entry: [
        actions.log('state.Registered.entry', duckula.id),
        actions.send(ctx => NoticingActor.Event.NOTICE(`欢迎${Object.values(ctx.contacts).map(c => c.name).join('，')}参加头脑风暴！`)),
      ],
      always: duckula.State.Processing,
    },
    [duckula.State.Feedbacked]: {
      entry: [
        actions.log('state.feedbacked.entry', duckula.id),
        actions.send(ctx => NoticingActor.Event.NOTICE(`感谢${Object.values(ctx.contacts).map(c => c.name).join('，')}的精彩头脑风暴！`)),
        actions.send(duckula.Event.NEXT()),
      ],
      on: {
        [duckula.Type.NEXT]: duckula.State.Processing,
      },
    },
  },
})

export default machine
