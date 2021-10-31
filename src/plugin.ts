/* eslint-disable brace-style */
import {
  Wechaty,
  // type,
  log,
  WechatyPlugin,
}                 from 'wechaty'

// import {
//   matchers,
//   talkers,
// }                         from 'wechaty-plugin-contrib'

// import {
//   MustacheView,
//   getMustacheView,
// }                         from './mustache-view.js'

import type {
  Bot5AssistantConfig,
}                         from './config.js'

import { onMessage } from './bot5-qingyu.js'

export function Bot5Assistant (config: Bot5AssistantConfig): WechatyPlugin {
  log.verbose('WechatyPluginContrib', 'Bot5Assistant(%s)', JSON.stringify(config))

  // const isVoteDown = (text: string): boolean => !!(config.downEmoji?.includes(text))
  // const isVoteUp   = (text: string): boolean => !!(config.upEmoji?.includes(text))

  // const isVoteManagedRoom  = matchers.roomMatcher(config.room)
  // const isWhitelistContact = matchers.contactMatcher(config.whitelist)

  // const talkRepeat = talkers.roomTalker<MustacheView>(config.repeat)
  // const talkWarn   = talkers.roomTalker<MustacheView>(config.warn)
  // const talkKick   = talkers.messageTalker<MustacheView>(config.kick)

  return function Bot5AssistantPlugin (wechaty: Wechaty) {
    log.verbose('WechatyPluginContrib', 'Bot5Assistant() Bot5AssistantPlugin(%s)', wechaty)

    wechaty.on('message', onMessage)
  }

}
