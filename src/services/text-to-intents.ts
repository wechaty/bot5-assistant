import { Intent } from '../schemas/mod.js'

const INTENT_PATTERNS = [
  [
    [ Intent.Start ],
    [
      /^\/start$/i,
      /开始|开会/i,
    ],
  ],
  [
    [ Intent.Stop ],
    [
      /^\/stop$/i,
      /开完|结束|结会|停止/i,
    ],
  ],
  [
    [ Intent.Affirm ],
    [
      /^\/(confirm|affirm|yes|ok)$/i,
      /是|是的|对的|好的|没错|可以啊|好啊|可以的|可以的/i,
    ],
  ],
  [
    [ Intent.Deny ],
    [
      /^\/(no|deny|cancel)$/i,
      /不|不是|不确认|不对|不要|不好|不行|不可以|没有/i,
    ],
  ],
  [
    [ Intent.Next ],
    [
      /^\/(next|forward)$/i,
      /下一步|继续/i,
    ],
  ],
  [
    [ Intent.Back ],
    [
      /^\/(back|prev|previous)$/i,
      /上一步|回退|退回|后退/i,
    ],
  ],
  [
    [ Intent.Cancel ],
    [
      /^\/cancel$/i,
      /取消/i,
    ],
  ],
  [
    [
      Intent.Start,
      Intent.Stop,
      Intent.Unknown,
    ],
    [
      /^三个Intents的测试$/i,
    ],
  ],
] as const

export const textToIntents = async (text?: string): Promise<Intent[]> => {
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
