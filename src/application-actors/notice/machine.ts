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

import duckula, { Context, Event, Events }    from './duckula.js'

const machine = createMachine<
  Context,
  Event
>({
  id: duckula.id,
  initial: duckula.State.Initializing,
  states: {
    [duckula.State.Initializing]: {
      entry: [
        actions.log(ctx => `states.Initializing.entry context ${JSON.stringify(ctx)}`, duckula.id),
      ],
      always: duckula.State.Idle,
    },

    [duckula.State.Idle]: {
      entry: [
        Mailbox.actions.idle(duckula.id),
      ],
      on: {
        '*': {
          target: duckula.State.Idle,  // enforce external transition
        },
        [duckula.Type.NOTICE]: duckula.State.Busy,
        [duckula.Type.CONVERSATION]: {
          actions: [
            actions.log((_, e) => `states.Idle.on.CONVERSATION ${e.payload.id}`, duckula.id),
            actions.assign({
              conversation: (_, e) => e.payload.id,
            }),
          ],
          target: duckula.State.Idle,  // enforce external transition
        },
      },
    },

    [duckula.State.Busy]: {
      entry: [
        actions.log<Context, Events['NOTICE']>((_, e) => `states.Busy.entry NOTICE ${e.payload.text}`, duckula.id),
        actions.choose<Context, Events['NOTICE']>([
          {
            cond: ctx => !!ctx.conversation,
            actions: [
              actions.send(
                (ctx, e) => CQRS.commands.SendMessageCommand(
                  CQRS.uuid.NIL,
                  ctx.conversation!,
                  CQRS.sayables.text(
                    `【系统通知】${e.payload.text}`,
                    e.payload.mentions,
                  ),
                ),
                { to: ctx => ctx.actors.wechaty },
              ),
            ],
          },
          {
            actions: actions.log('states.Busy.entry no conversationId', duckula.id),
          },
        ]),
      ],
      always: duckula.State.Idle,
    },

  },
})

export default machine
