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
/**
 * Microsoft.Recognizers.Text for JavaScript
 * @link https://github.com/Microsoft/Recognizers-Text/tree/master/JavaScript/packages/recognizers-text-suite
 */
import Recognizers            from '@microsoft/recognizers-text-suite'
import DateTimeRecognizers    from '@microsoft/recognizers-text-date-time'

import { isDefined }    from '../../pure/is-defined.js'

const model = new DateTimeRecognizers.DateTimeRecognizer(Recognizers.Culture.Chinese).getDateTimeModel()

export async function textToDate (
  text?: string,
): Promise<undefined | any> {
  if (!text) {
    return undefined
  }

  // interface ModelResult {
  //   text: string;
  //   start: number;
  //   end: number;
  //   typeName: string;
  //   resolution: {
  //     [key: string]: any;
  //   };
  // }
  //
  // Array [
  //   Object {
  //     "start": 0,
  //     "end": 6,
  //     "resolution": Object {
  //       "values": Array [
  //         Object {
  //           "timex": "2022-05-20T19",
  //           "type": "datetime",
  //           "value": "2022-05-20 19:00:00",
  //         },
  //       ],
  //     },
  //     "text": "下周五晚上7点",
  //     "typeName": "datetimeV2.datetime",
  //   },
  // ]
  const result = model.parse(text)
    // .map(r => { console.info('DEBUG', r); return r })
    .filter(r => r.typeName === 'datetimeV2.datetime')
    .map(r => r.resolution['values'] as undefined | [{ type: string, value: string }])
    .filter(isDefined)
    .map(v => v.filter(i => i.type === 'datetime'))
    .map(v => v.map(i => i.value))
    .flat()[0]

  return result && new Date(result)
}
