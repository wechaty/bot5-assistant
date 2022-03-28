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
import type * as PUPPET   from 'wechaty-puppet'
import type { Wechaty }   from 'wechaty'

import * as types       from './types.js'
import type { Intent }  from './intent-type.js'

const payloadMessage   = (message: PUPPET.payloads.Message)     => ({ message })
const payloadRoom      = (room: PUPPET.payloads.Room)           => ({ room })
const payloadContacts  = (contacts: PUPPET.payloads.Contact[])  => ({ contacts })

const payloadText      = (text: string)     => ({ text })
const payloadSay       = (text: string, conversation: string, mentions: string[] = []) => ({ conversation, mentions, text })
const payloadWechaty   = (wechaty: Wechaty) => ({ wechaty })

const payloadAbort     = (reason: string) => ({ reason })
const payloadReset     = (reason: string) => ({ reason })
const payloadCancel    = (reason: string) => ({ reason })
const payloadGerror     = (gerror: string) => ({ gerror })
const payloadData      = (data: any) => ({ data })

const payloadIntents  = (intents: readonly Intent[]) => ({ intents })

const payloadFeedbacks  = (feedbacks: { [contactId: string]: string }) => ({ feedbacks })
const payloadFeedback  = (contactId: string, feedback: string) => ({ contactId, feedback })

const payloadMinute = (minutes: string) => ({ minutes })

export const mention     = createAction(types.MENTION, payloadContacts)()
export const message     = createAction(types.MESSAGE, payloadMessage)()

export const back        = createAction(types.BACK)()
export const next        = createAction(types.NEXT)()

export const noAudio    = createAction(types.NO_AUDIO)()
export const noMention  = createAction(types.NO_MENTION)()

export const room = createAction(types.ROOM, payloadRoom)()

export const contacts   = createAction(types.CONTACTS,  payloadContacts)()
export const attendees  = createAction(types.ATTENDEES, payloadContacts)()
export const admins     = createAction(types.ADMINS,    payloadContacts)()
export const chairs     = createAction(types.CHAIRS,    payloadContacts)()

export const start       = createAction(types.START)()
export const stop        = createAction(types.STOP)()

export const text        = createAction(types.TEXT, payloadText)()
export const say         = createAction(types.SAY, payloadSay)()

export const feedbacks    = createAction(types.FEEDBACKS, payloadFeedbacks)()
export const feedback     = createAction(types.FEEDBACK, payloadFeedback)()

export const cancel  = createAction(types.CANCEL, payloadCancel)()
export const abort  = createAction(types.ABORT, payloadAbort)()
export const gerror  = createAction(types.GERROR, payloadGerror)()
export const reset  = createAction(types.RESET, payloadReset)()

export const intents = createAction(types.INTENTS, payloadIntents)()

export const wechaty  = createAction(types.WECHATY, payloadWechaty)()

/**
 * Complete v.s. Finish
 *  @see https://ejoy-english.com/blog/complete-vs-finish-similar-but-different/
 */
export const finish  = createAction(types.FINISH, payloadData)()
export const complete  = createAction(types.COMPLETE, payloadData)()

export const introduce = createAction(types.INTRODUCE)()
export const report = createAction(types.REPORT)()

const payloadIdle = (data?: string) => ({ reason: data })
export const idle = createAction(types.IDLE, payloadIdle)()

export const check = createAction(types.CHECK)()

export const process = createAction(types.PROCESS)()
export const parse = createAction(types.PARSE)()

const payloadNotice = (notice: string) => ({ notice })
export const notice = createAction(types.NOTICE, payloadNotice)()

export const minute = createAction(types.MINUTE, payloadMinute)()

const payloadConversation = (conversationId: string) => ({ conversationId })
export const conversation = createAction(types.CONVERSATION, payloadConversation)()

export const nop = createAction(types.NOP)()
