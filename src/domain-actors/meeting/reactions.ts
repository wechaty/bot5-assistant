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
import { actions }    from 'xstate'

import * as duck    from '../../duck/mod.js'

import duckula, { Context, Events }   from './duckula.js'

export const messageToIntents = actions.send<Context, Events['MESSAGE']>((_, e) => e, { to: ctx => ctx.actors.intent })

export const chairMessageToIntents = actions.choose<Context, Events['MESSAGE']>([
  {
    cond: (ctx, e) => ctx.chairs.map(c => c.id).includes(e.payload.message.talkerId),
    actions: messageToIntents,
  },
])

export const nextIntentToNext = actions.choose<Context, Events['INTENTS']>([
  {
    cond: (_, e) => e.payload.intents.includes(duck.Intent.Next),
    actions: actions.send(duckula.Event.NEXT()),
  },
])
