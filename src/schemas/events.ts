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

import * as types       from './types.js'
import type { Intent }  from './intent-type.js'

const payloadRoom      = (room: PUPPET.payloads.Room)           => ({ room })

const payloadText      = (text: string)     => ({ text })
const payloadSay       = (text: string, conversation: string, mentions: string[] = []) => ({ conversation, mentions, text })

const payloadAbort     = (reason: string) => ({ reason })
const payloadReset     = (reason: string) => ({ reason })
const payloadCancel    = (reason: string) => ({ reason })
const payloadData      = (data: any) => ({ data })

const payloadIntents  = (intents: readonly Intent[]) => ({ intents })

const payloadFeedbacks  = (feedbacks: { [contactId: string]: string }) => ({ feedbacks })
const payloadFeedback  = (contactId: string, feedback: string) => ({ contactId, feedback })

const payloadMinute = (minutes: string) => ({ minutes })

const payloadContacts   = (contacts: PUPPET.payloads.Contact[])  => ({ contacts })
export const MENTION    = createAction(types.MENTION,   payloadContacts)()
export const CONTACTS   = createAction(types.CONTACTS,  payloadContacts)()
export const ATTENDEES  = createAction(types.ATTENDEES, payloadContacts)()
export const ADMINS     = createAction(types.ADMINS,    payloadContacts)()
export const CHAIRS     = createAction(types.CHAIRS,    payloadContacts)()

const payloadMessage  = (message: PUPPET.payloads.Message) => ({ message })
export const MESSAGE  = createAction(types.MESSAGE, payloadMessage)()

export const BACK        = createAction(types.BACK)()
export const NEXT        = createAction(types.NEXT)()

export const NO_AUDIO    = createAction(types.NO_AUDIO)()
export const NO_MENTION  = createAction(types.NO_MENTION)()

export const ROOM = createAction(types.ROOM, payloadRoom)()

export const START       = createAction(types.START)()
export const STOP        = createAction(types.STOP)()

export const NO_TEXT     = createAction(types.NO_TEXT)()
export const TEXT        = createAction(types.TEXT, payloadText)()
export const SAY         = createAction(types.SAY, payloadSay)()

export const FEEDBACKS    = createAction(types.FEEDBACKS, payloadFeedbacks)()
export const FEEDBACK     = createAction(types.FEEDBACK, payloadFeedback)()

export const CANCEL  = createAction(types.CANCEL, payloadCancel)()
export const ABORT  = createAction(types.ABORT, payloadAbort)()

const payloadGerror = (gerror: string) => ({ gerror })
export const GERROR = createAction(types.GERROR, payloadGerror)()

export const RESET  = createAction(types.RESET, payloadReset)()

export const INTENTS = createAction(types.INTENTS, payloadIntents)()

/**
 * Complete v.s. Finish
 *  @see https://ejoy-english.com/blog/complete-vs-finish-similar-but-different/
 */
export const FINISH   = createAction(types.FINISH, payloadData)()
export const COMPLETE = createAction(types.COMPLETE, payloadData)()

export const INTRODUCE  = createAction(types.INTRODUCE)()
export const REPORT     = createAction(types.REPORT)()

const payloadIdle = (data?: string) => ({ reason: data })
export const IDLE = createAction(types.IDLE, payloadIdle)()

export const CHECK = createAction(types.CHECK)()

export const PROCESS = createAction(types.PROCESS)()
export const PARSE = createAction(types.PARSE)()

const payloadNotice = (notice: string) => ({ notice })
export const NOTICE = createAction(types.NOTICE, payloadNotice)()

export const MINUTE = createAction(types.MINUTE, payloadMinute)()

const payloadConversation = (conversationId: string) => ({ conversationId })
export const CONVERSATION = createAction(types.CONVERSATION, payloadConversation)()

export const NOP = createAction(types.NOP)()

const payloadFileBox = (fileBox: string) => ({ fileBox })
export const FILE_BOX = createAction(types.FILE_BOX, payloadFileBox)()
