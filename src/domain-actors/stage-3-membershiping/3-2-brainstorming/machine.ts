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
import { actions, createMachine }   from 'xstate'
import * as Mailbox                 from 'mailbox'

import { responseStates } from '../../../pure/mod.js'

import * as Notice     from '../../../application-actors/notice/mod.js'
import * as Feedback   from '../../../application-actors/feedback/mod.js'

import duckula, { Context, Event }    from './duckula.js'
import * as selectors                 from './selectors.js'

const machine = createMachine<Context, Event>({
  id: duckula.id,

  /**
   * Internal Events (not exposed to outside)
   *  or the Mailbox queue will be blocked forever
   *  because of breaking of the `Mailbox.actions.idle()` protocol.
   */
  on: {
    [duckula.Type.NOTICE]: {
      actions: [
        actions.log((_, e) => `on.NOTICE ${e.payload.text}`, duckula.id),
        actions.send(
          (_, e) => duckula.Event.NOTICE('【头脑风暴】' + e.payload.text, e.payload.mentions),
          { to: ctx => ctx.actors.notice },
        ),
      ],
    },
    [duckula.Type.HELP]: {
      actions: [
        actions.log('on.HELP', duckula.id),
        actions.send(ctx => Notice.Event.NOTICE(
          [
            '头脑风暴环节：每位参会者按照报名确认顺序，在 BOT Friday Club 微信群中，通过“按住说话”功能，把自己在活动中得到的新点子与大家分享。',
            `当前主席：${Object.values(ctx.chairs).map(c => c.name).join('，')}`,
            `当前参会者：${Object.values(ctx.contacts).map(c => c.name).join('，')}`,
            `已经完成头脑风暴的参会者：${Object.keys(ctx.feedbacks).map(c => ctx.contacts[c]?.name).join('，')}`,
            `还没有完成头脑风暴的参会者：${Object.values(ctx.contacts).filter(c => !ctx.feedbacks[c.id]).map(c => c.name).join('，')}`,
          ].join('\n'),
          Object.keys(ctx.contacts),
        )),
      ],
    },
  },

  initial: duckula.State.Initializing,
  states: {
    [duckula.State.Initializing]: {
      entry: [
        actions.log(ctx => `states.Initializing.entry context ${JSON.stringify(ctx)}`, duckula.id),
      ],
      always: duckula.State.Idle,
    },
    [duckula.State.Resetting]: {
      entry: [
        actions.log('states.Resetting.entry', duckula.id),
        actions.assign(duckula.initialContext()),
        // actions.send(Feedback.Event.RESET(), { to: Feedback.id }),
      ],
      always: duckula.State.Initializing,
    },

    /**
     * Idle
     *
     * 1. received REPORT -> transition to Reporting
     */
    [duckula.State.Idle]: {
      entry: [
        actions.log('states.Idle.entry', duckula.id),
        Mailbox.actions.idle(duckula.id),
      ],
      on: {
        '*'                    : duckula.State.Idle,         // enforce external transition for Mailbox actor protocol
        [duckula.Type.REPORT]  : duckula.State.Reporting,
        [duckula.Type.RESET]   : duckula.State.Resetting,
      },
    },

    /**
     * Reporting
     *
     * 1. no contacts -> emit REGISTER
     * 2. feedbacks >= contacts ? emit FEEDBACKS : NEXT
     *
     * 3. received FEEDBACKS  -> transition to Responding
     * 4. received NEXT       -> transition to Feedbacking
     * 5. received REGISTER   -> transition to Registering
     */
    [duckula.State.Reporting]: {
      entry: [
        actions.log(ctx => `states.Reporting.entry feedbacks/contacts #${selectors.feedbacksNum(ctx)}/${selectors.contactsNum(ctx)}`, duckula.id),
        actions.choose([
          {
            cond: ctx => selectors.feedbacksNum(ctx) >= selectors.contactsNum(ctx),
            actions: actions.send(ctx => duckula.Event.FEEDBACKS(ctx.feedbacks)),
          },
          { actions: actions.send(duckula.Event.NEXT()) },
        ]),
      ],
      on: {
        [duckula.Type.FEEDBACKS] : duckula.State.Responding,
        [duckula.Type.NEXT]      : duckula.State.Feedbacking,
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
      ],
      invoke: {
        id: Feedback.id,
        src: ctx => Mailbox.wrap(
          Feedback.machine.withContext({
            ...Feedback.initialContext(),
            contacts: {
              ...ctx.chairs,
              ...ctx.contacts,
            },
            actors: {
              notice: ctx.actors.notice,
              wechaty: ctx.actors.wechaty,
            },
          }),
        ),
      },
      on: {
        /**
         * 1. Forward [MESSAGE] to FeedbackActor
         */
        [Feedback.Type.MESSAGE]: {
          actions: actions.send((_, e) => e, { to: Feedback.id }),
        },
        /**
         * 2. Expect [FEEDBACKS] from FeedbackActor
         */
        [Feedback.Type.FEEDBACKS]: {
          actions: [
            actions.assign({
              feedbacks: (_, e) => e.payload.feedbacks,
            }),
          ],
          target: duckula.State.Feedbacked,
        },
        [Feedback.Type.GERROR]: duckula.State.Erroring,
      },
    },

    [duckula.State.Feedbacked]: {
      entry: [
        actions.send(ctx => Notice.Event.NOTICE(
          [
            '头脑风暴环节完成，感谢大家的参与！每个参会成员的反馈，都将被收集并分享。',
            ...Object.entries(ctx.feedbacks)
              .map(([ id, feedback ]) => [
                `${{ ...ctx.contacts, ...ctx.chairs }[id]?.name ?? id}`,
                '：',
                feedback,
              ].join('')),
          ].join('\n'),
          Object.keys(ctx.contacts),
        )),
        actions.send(ctx => duckula.Event.FEEDBACKS(ctx.feedbacks)),
      ],
      on: {
        [duckula.Type.FEEDBACKS]: duckula.State.Responding,
      },
    },

    ...responseStates(duckula.id),
  },
})

export default machine
