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
import * as CQRS                    from 'wechaty-cqrs'
import * as Mailbox                 from 'mailbox'

import duckula    from './duckula.js'

const machine = createMachine<
  ReturnType<typeof duckula.initialContext>,
  ReturnType<typeof duckula.Event[keyof typeof duckula.Event]>
>({
  id: duckula.id,
  initial: duckula.State.Initializing,
  context: duckula.initialContext,
  states: {
    [duckula.State.Initializing]: {
      always: duckula.State.Idle,
    },

    [duckula.State.Idle]: {
      entry: [
        Mailbox.actions.idle(duckula.id)('idle'),
      ],
      on: {
        '*': {
          target: duckula.State.Idle,  // enforce external transition
        },
        [duckula.Type.NOTICE]: duckula.State.Noticing,
        [duckula.Type.CONVERSATION]: {
          actions: [
            actions.log((_, e) => `duckula.State.Idle.on.CONVERSATION ${e.payload.conversationId}`, duckula.id),
            actions.assign({
              conversationId: (_, e) => e.payload.conversationId,
            }),
          ],
          target: duckula.State.Idle,  // enforce external transition
        },
      },
    },

    [duckula.State.Noticing]: {
      entry: [
        actions.log('duckula.State.Noticing.entry', duckula.id),
        actions.choose<ReturnType<typeof duckula.initialContext>, ReturnType<typeof duckula.Event.NOTICE>>([
          {
            cond: ctx => !!ctx.conversationId,
            actions: [
              actions.send(
                (ctx, e) => CQRS.commands.SendMessageCommand(
                  CQRS.uuid.NIL,
                  ctx.conversationId!,
                  CQRS.sayables.text(
                    `【系统通知】${e.payload.text}`,
                    e.payload.mentions,
                  ),
                ),
                { to: ctx => ctx.address.wechaty },
              ),
            ],
          },
          {
            actions: actions.log('duckula.State.Noticing.entry no conversationId', duckula.id),
          },
        ]),
      ],
      always: duckula.State.Idle,
    },

  },
})

export default machine
