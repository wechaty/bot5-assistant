import {
  Message,
  types,
}                   from 'wechaty'

import { Intent } from '../schemas/mod.js'

const INTENT_PATTERNS = [
  [
    [
      Intent.Start,
    ],
    [
      /^\/start$/i,
      /开始|开会/i,
    ],
  ],
  [
    [Intent.Stop],
    [
      /^\/stop$/i,
      /开完|结束|结会|停止/i,
    ],
  ],
  [
    [
      Intent.Start,
      Intent.Stop,
      Intent.Unknown,
    ],
    [
      /^都可能/i,
    ],
  ],
] as const

const textToIntents = async (text?: string): Promise<Intent[]> => {
  const intentList: Intent[] = []

  if (!text) {
    return intentList
  }

  for (const [intents, res] of INTENT_PATTERNS) {
    for (const regex of res) {
      if (regex.test(text)) {
        intentList.push(...intents)
      }
    }
  }

  return intentList
}

const messageToIntents = async (message: Message): Promise<Intent[]> => {
  const intentList: Intent[] = []

  switch (message.type()) {
    case types.Message.Text:
      intentList.push(
        ...await textToIntents(message.text()),
      )
      break

    default:
      intentList.push(Intent.Unknown)
      break
  }

  return intentList
}

export {
  Intent,
  textToIntents,
  messageToIntents,
}
