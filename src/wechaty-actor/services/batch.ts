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
import { isActionOf }             from 'typesafe-actions'
import type { AnyEventObject }    from 'xstate'

import duckula   from '../duckula.js'

import { execute } from './execute.js'

export const batch = async (
  ctx: ReturnType<typeof duckula.initialContext>,
  e: AnyEventObject,
) => {

  if (!isActionOf(duckula.Event.BATCH_EXECUTE, e)) {
    throw new Error(`${duckula.id} service.batch: unknown event [${e.type}]`)
  }

  return Promise.all(
    e.payload.commandQueryList
      .map(commandQuery =>
        execute(
          ctx,
          duckula.Event.EXECUTE(commandQuery),
        ),
      ),
  )

}
