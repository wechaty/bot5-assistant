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
import { FileBox, FileBoxInterface }    from 'file-box'
import path                             from 'path'
import { fileURLToPath }                from 'url'

export const getSilkFixtures = async () => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))

  const EXPECTED_TEXT = '大可乐两个统一，冰红茶三箱。'
  const base64 = await FileBox.fromFile(path.join(
    __dirname,
    '../../tests/fixtures/sample.sil',
  )).toBase64()

  const FILE_BOX = FileBox.fromBase64(base64, 'sample.sil') as FileBoxInterface

  return {
    fileBox: FILE_BOX,
    text: EXPECTED_TEXT,
  }
}
