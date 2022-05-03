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
import { Intent } from './intent-fancy-enum.js'

const INTENT_PATTERNS = [
  /**
   * Testing only
   */
  [
    [
      Intent.Start,
      Intent.Stop,
      Intent.Unknown,
    ],
    [
      /^三个Intents的测试（23a6f026-f861-48b6-b691-ab11f364774e）$/i,
    ],
  ],
  [
    [
      Intent.CocaCola,
    ],
    [
      /**
       * Match all keywords in the sentence
       *
       *  SO: Regex to match string containing two names in any order
       *    @link https://stackoverflow.com/a/4389683/1123955
       */
      /^(?=.*可乐)(?=.*两个)(?=.*统一)(?=.*红茶)(?=.*三箱).*$/,
    ],
  ],

  /**
   * Production values
   */
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
      /^yes|ok|对|好|是|是的|对的|好的|没错|可以啊|好啊|可以的|可以的$/i,
    ],
  ],
  [
    [ Intent.Deny ],
    [
      /^\/(no|deny|cancel)$/i,
      /^no|否|不|不是|不确认|不对|不要|不好|不行|不可以|没有$/i,
    ],
  ],
  [
    [ Intent.Next ],
    [
      /^\/(next|forward)$/i,
      /^next|下一步$/i,
    ],
  ],
  [
    [ Intent.Back ],
    [
      /^\/(back|prev|previous)$/i,
      /^back|上一步|回退|退回|后退$/i,
    ],
  ],
  [
    [ Intent.Cancel ],
    [
      /^\/cancel$/i,
      /取消|cancel/i,
    ],
  ],
  [
    [ Intent.Continue ],
    [
      /^\/continue$/i,
      /^继续$/i,
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

  if (intentList.length <= 0) {
    intentList.push(Intent.Unknown)
  }

  return intentList
}
