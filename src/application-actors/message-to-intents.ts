import {
  Message,
  types,
}                   from 'wechaty'

import { intents, Intent } from '../schemas/mod.js'

const INTENT_PATTERNS = [
  [
    [ intents.start ],
    [
      /^\/start$/i,
      /开始|开会/i,
    ],
  ],
  [
    [ intents.stop ],
    [
      /^\/stop$/i,
      /开完|结束|结会|停止/i,
    ],
  ],
  [
    [ intents.affirm ],
    [
      /^\/(confirm|affirm|yes|ok)$/i,
      /是|是的|对的|好的|没错|可以啊|好啊|可以的|可以的/i,
    ],
  ],
  [
    [ intents.deny ],
    [
      /^\/(no|deny|cancel)$/i,
      /不|不是|不确认|不对|不要|不好|不行|不可以|没有/i,
    ],
  ],
  [
    [ intents.next ],
    [
      /^\/(next|forward)$/i,
      /下一步|继续/i,
    ],
  ],
  [
    [ intents.back ],
    [
      /^\/(back|prev|previous)$/i,
      /上一步|回退|退回|后退/i,
    ],
  ],
  [
    [ intents.cancel ],
    [
      /^\/cancel$/i,
      /取消/i,
    ],
  ],
  [
    [
      intents.start,
      intents.stop,
      intents.unknown,
    ],
    [
      /^三个Intents的测试$/i,
    ],
  ],
] as const

const textToIntents = async (text?: string): Promise<Intent[]> => {
  const intentList: Intent[] = []

  if (!text) {
    return intentList
  }

  for (const [ intents, res ] of INTENT_PATTERNS) {
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
      intentList.push(intents.unknown)
      break
  }

  return intentList
}

export {
  textToIntents,
  messageToIntents,
}
