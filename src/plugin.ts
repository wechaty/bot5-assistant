/**
 *   Wechaty Open Source Software - https://github.com/wechaty
 *
 *   @copyright 2016 Huan LI (李卓桓) <https://github.com/huan>, and
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
import {
  Wechaty,
  log,
  types,
  WechatyPlugin,
}                   from 'wechaty'
import {
  matchers,
  talkers,
}                     from 'wechaty-plugin-contrib'
import type * as Mailbox   from 'mailbox'

import * as Actors from './domain-actors/mod.js'

import type { Bot5AssistantConfig }   from './config.js'

import { processMessage } from './bot5-qingyu.js'

export interface Bot5AssistantContext {
  actor: Mailbox.Address
  wechaty: Wechaty,
}

const dongOptions: talkers.MessageTalkerOptions = [
  'dong 开会状态： {{ inMeeting }}',
]

export function Bot5Assistant (config: Bot5AssistantConfig): WechatyPlugin {
  log.verbose('bot5-assistant', 'Bot5Assistant(%s)', JSON.stringify(config))

  const isMeetingRoom = matchers.roomMatcher(config.room)
  const talkDong      = talkers.messageTalker<{ inMeeting: string }>(dongOptions)

  return function Bot5AssistantPlugin (wechaty: Wechaty) {
    log.verbose('bot5-assistant', 'Bot5Assistant() Bot5AssistantPlugin(%s)', wechaty)

    const context: Bot5AssistantContext = {
      fsm:      getInterpreter(wechaty),
      wechaty:  wechaty,
    }

    wechaty.on('message', async message => {
      /**
       * message validation
       */
      if (message.type() !== types.Message.Text) { return }
      if (message.self())                       { return }

      const room  = message.room()
      if (!room)                                { return }
      if (!await isMeetingRoom(room))           { return }

      // const talker = message.talker()
      // const mentionList = await message.mentionList()
      // if (mentionList.length <= 0)              { return }

      const text = await message.mentionText()
      if (text === 'ding') {
        await talkDong(message, {
          inMeeting: context.fsm.state.matches('meeting') ? '是' : '否',
        })
      }

      return processMessage(context, message)
    })
  }

}
