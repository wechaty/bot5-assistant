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
import { createAction }   from 'typesafe-actions'

import type { CommandQuery, ResponseEvent }   from './dto.js'
import * as types                             from './types.js'

export const nop  = createAction(types.NOP)()
export const idle = createAction(types.IDLE)()

const payloadExecute = (commandQuery: CommandQuery) => ({ commandQuery })
export const execute = createAction(types.EXECUTE, payloadExecute)()

const payloadResponse = (response: ResponseEvent) => ({ response })
export const response = createAction(types.RESPONSE, payloadResponse)()

/**
 * Batched
 */
const payloadBatch = (commandQueryList: CommandQuery[]) => ({ commandQueryList })
export const batch = createAction(types.BATCH, payloadBatch)()

const payloadBatchResponse = (responseList: ResponseEvent[]) => ({ responseList })
export const batchResponse = createAction(types.BATCH_RESPONSE, payloadBatchResponse)()
