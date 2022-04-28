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
import { Intent } from '../../duck/mod.js'

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
