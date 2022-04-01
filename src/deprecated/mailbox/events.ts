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
/* eslint-disable sort-keys */
import { createAction }                       from 'typesafe-actions'
import type { AnyEventObject, EventObject }   from 'xstate'

import { Types }            from './types.js'
import type * as contexts   from './contexts.js'

/**
 * events of: child
 *
 * IDLE is the most important event for Mailbox actor:
 *  it must be send whenever the child machine is idle.
 *  so that the Mailbox can be able to send messages to the child machine
 */
const payloadChildIdle  = (debug?: string) => ({ debug })
export const CHILD_IDLE = createAction(Types.CHILD_IDLE,  payloadChildIdle)()

const payloadChildReply = (message: EventObject)  => ({ message })
export const CHILD_REPLY = createAction(Types.CHILD_REPLY, payloadChildReply)()

/**
 * events of: queue
 */
const payloadNewMessage   = (debug?: string) => ({ debug })
export const NEW_MESSAGE  = createAction(Types.NEW_MESSAGE, payloadNewMessage)()

const payloadDispatch = (debug?: string) => ({ debug })
export const DISPATCH = createAction(Types.DISPATCH, payloadDispatch)()

const payloadDequeue  = (message: contexts.AnyEventObjectExt) => ({ message })
export const DEQUEUE  = createAction(Types.DEQUEUE, payloadDequeue)()

/**
 * events for : debugging
 */
const payloadReset  = (debug?: string) => ({ debug })
export const RESET  = createAction(Types.RESET, payloadReset)()

const payloadDeadLetter   = (message: AnyEventObject, debug?: string) => ({ message, debug })
export const DEAD_LETTER  = createAction(Types.DEAD_LETTER, payloadDeadLetter)()
