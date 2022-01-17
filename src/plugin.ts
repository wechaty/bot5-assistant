import {
  Wechaty,
  log,
  types,
  WechatyPlugin,
}                 from 'wechaty'

import {
  matchers,
  talkers,
}                         from 'wechaty-plugin-contrib'

import * as Mailbox from './mailbox/mod.js'
import * as Actors from './actors/mod.js'

import type {
  Bot5AssistantConfig,
}                         from './config.js'

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
