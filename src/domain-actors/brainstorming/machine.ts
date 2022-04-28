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
import { actions, AnyEventObject, createMachine }   from 'xstate'
import * as Mailbox                 from 'mailbox'

import * as NoticingActor from '../noticing/mod.js'
import * as RegisterActor from '../register/mod.js'

import duckula, { Context, Event, Events }    from './duckula.js'
import * as selectors                         from './selectors.js'

const machine = createMachine<Context, Event>({
  id: duckula.id,
  context: duckula.initialContext,
  initial: duckula.State.Initializing,
  on: {
    [duckula.Type.RESET]: duckula.State.Resetting,
    [duckula.Type.NOTICE]: {
      actions: [
        actions.log((_, e) => `on.NOTICE ${e.payload.text}`, duckula.id),
        actions.send((_, e) => e, { to: ctx => ctx.address.noticing }),
      ],
    },
    [duckula.Type.INTRODUCE]: {
      actions: [
        actions.log('on.INTRODUCE', duckula.id),
        actions.send(ctx => NoticingActor.Event.NOTICE(
          [
            '头脑风暴环节：每位参会者按照报名确认顺序，在 BOT Friday Club 微信群中，通过“按住说话”功能，把自己在活动中得到的新点子与大家分享。',
            `当前主席：${Object.values(ctx.chairs).map(c => c.name).join('，')}`,
            `当前参会者：${Object.values(ctx.contacts).map(c => c.name).join('，')}`,
            `已经完成头脑风暴的参会者：${Object.keys(ctx.feedbacks).map(c => ctx.contacts[c]?.name).join('，')}`,
            `还没有完成头脑风暴的参会者：${Object.values(ctx.contacts).filter(c => !ctx.feedbacks[c.id]).map(c => c.name).join('，')}`,
          ].join('\n'),
          Object.values(ctx.contacts).map(c => c.id),
        )),
      ],
    },
  },
  preserveActionOrder: true,
  states: {

    [duckula.State.Resetting]: {
      entry: [
        actions.log('states.Resetting.entry', duckula.id),
        actions.assign(_ => duckula.initialContext()),
      ],
      always: duckula.State.Initializing,
    },

    [duckula.State.Initializing]: {
      entry: [
        actions.log('states.Initializing.entry', duckula.id),
      ],
      always: duckula.State.Idle,
    },

    /**
     * Idle
     *
     * 1. received REPORT -> transition to Reporting
     * 2. received ROOM -> assign to context.room
     *
     */
    [duckula.State.Idle]: {
      entry: [
        actions.log('states.Idle.entry', duckula.id),
        Mailbox.actions.idle(duckula.id),
      ],
      on: {
        '*': duckula.State.Idle,  // enforce external transition for Mailbox actor protocol
        [duckula.Type.REPORT]: duckula.State.Reporting,
        [duckula.Type.ROOM]: {
          actions: actions.assign({ room: (_, e) => e.payload.room }),
          target: duckula.State.Idle,
        },
      },
    },

    /**
     * Reporting
     *
     * 1. feedbacks >= contacts -> emit COMPLETE
     * 2. feedbacks < contacts  -> emit NEXT
     *
     * 3. received COMPLETE   -> transition to Completed
     * 4. received NEXT       -> transition to Completing
     *
     */
    [duckula.State.Reporting]: {
      entry: [
        actions.log(ctx => `states.Reporting.entry feedbacks/contacts #${selectors.feedbacksNum(ctx)}/${selectors.contactsNum(ctx)}`, duckula.id),
        actions.choose<Context, any>([
          {
            cond: ctx => selectors.contactsNum(ctx) <= 0,
            actions: actions.send(duckula.Event.NO_CONTACT()),
          },
          {
            cond: ctx => selectors.feedbacksNum(ctx) >= selectors.contactsNum(ctx),
            actions: actions.send(duckula.Event.COMPLETE()),
          },
          {
            actions: actions.send(duckula.Event.NEXT()),
          },
        ]),
      ],
      on: {
        [duckula.Type.NO_CONTACT] : duckula.State.Registering,
        [duckula.Type.NEXT]       : duckula.State.Completing,
        [duckula.Type.COMPLETE]   : duckula.State.Completed,
      },
    },

    /**
     * Completing
     *
     * 1. if contacts <= 0          -> emit NO_CONTACT
     * 2. if feedbacks < contacts   -> emit NEXT
     * 3. if feedbacks >= contacts  -> emit COMPLETE
     *
     * 4. received NO_CONTACT   -> transition to Registering
     * 5. received NEXT         -> transition to Feedbacking
     * 6. received COIMPLETE    -> transition to Completed
     */
    [duckula.State.Completing]: {
      entry: [
        actions.log('states.Completing.entry', duckula.id),
        actions.choose<Context, AnyEventObject>([
          {
            cond: ctx => selectors.contactsNum(ctx) <= 0,
            actions: actions.send(duckula.Event.NO_CONTACT()),
          },
          {
            cond: ctx => selectors.feedbacksNum(ctx) < selectors.contactsNum(ctx),
            actions: actions.send(duckula.Event.NEXT()),
          },
          {
            actions: [
              actions.send(duckula.Event.COMPLETE()),
            ],
          },
        ]),
      ],
      on: {
        [duckula.Type.NO_CONTACT] : duckula.State.Registering,
        [duckula.Type.NEXT]       : duckula.State.Feedbacking,
        [duckula.Type.COMPLETE]   : duckula.State.Completed,
      },
    },

    [duckula.State.Completed]: {
      entry: [
        actions.log('states.Completed.entry', duckula.id),
        actions.send(ctx => NoticingActor.Event.NOTICE(
          '【脑爆系统】叮！系统检测到您已经成功完成头脑风暴，恭喜宿主！',
          Object.values(ctx.contacts).map(c => c.id),
        )),
        actions.send(ctx => duckula.Event.FEEDBACKS(ctx.feedbacks)),
      ],
      on: {
        [duckula.Type.FEEDBACKS]: duckula.State.Responding,
      },
    },

    /**
     *
     * Ask CONTACTS from Register Actor
     *
     */
    [duckula.State.Registering]: {
      entry: [
        actions.log('states.Registering.entry', duckula.id),
        actions.send(
          RegisterActor.Event.REPORT(),
          { to: ctx => ctx.address.register },
        ),
      ],
      on: {
        /**
         * 1. Forward [MESSAGE] to RegisterActor
         */
        [duckula.Type.MESSAGE]: {
          actions: [
            actions.send(
              (_, e) => e,
              { to: ctx => ctx.address.register },
            ),
            actions.log('states.Registering.on.MESSAGE forwarding to register ...', duckula.id),
          ],
        },
        /**
         * 2. Expect [CONTACTS] from RegisterActor
         */
        [duckula.Type.CONTACTS]: {
          actions: [
            actions.log((_, e) => `state.Registering.on.CONTACTS ${e.payload.contacts.map(c => `@${c.name}`).join(', ')}`, duckula.id),
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

    [duckula.State.Registered]: {
      entry: [
        actions.log('states.Registered.entry', duckula.id),
        actions.send(ctx => NoticingActor.Event.NOTICE(`欢迎${Object.values(ctx.contacts).map(c => c.name).join('，')}参加头脑风暴！`)),
        actions.send(duckula.Event.NEXT()),
      ],
      on: {
        [duckula.Type.NEXT]: duckula.State.Completing,
      },
    },

    /**
     *
     * Ask Feedbacks from Feedback Actor
     *
     */
    [duckula.State.Feedbacking]: {
      entry: [
        actions.log('states.Feedbacking.entry', duckula.id),
        actions.send(
          RegisterActor.Event.REPORT(),
          { to: ctx => ctx.address.feedback },
        ),
      ],
      on: {
        /**
         * 1. Forward [MESSAGE] to FeedbackActor
         */
        [duckula.Type.MESSAGE]: {
          actions: actions.send((_, e) => e, { to: ctx => ctx.address.feedback }),
        },
        /**
         * 2. Expect [FEEDBACKS] from FeedbackActor
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

    [duckula.State.Feedbacked]: {
      entry: [
        actions.log('states.Feedbacked.entry', duckula.id),
        actions.send(ctx => NoticingActor.Event.NOTICE(`感谢${Object.values(ctx.contacts).map(c => c.name).join('，')}的精彩头脑风暴！`)),
        actions.send(duckula.Event.NEXT()),
      ],
      on: {
        [duckula.Type.NEXT]: duckula.State.Completing,
      },
    },

    /**
     *
     * Responses
     *
     */
    [duckula.State.Responding]: {
      entry: [
        actions.log((_, e) => `state.Responding.entry [${e.type}]`, duckula.id),
        Mailbox.actions.reply((_, e) => e),
      ],
      always: duckula.State.Idle,
    },

    [duckula.State.Erroring]: {
      entry: [
        actions.log((_, e) => `state.Erroring.entry GERROR ${(e as Events['GERROR']).payload.gerror}`, duckula.id),
        Mailbox.actions.reply((_, e) => e),
      ],
      always: duckula.State.Idle,
    },

  },
})

export default machine
