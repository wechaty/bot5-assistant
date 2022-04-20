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

import { Type }         from './type-fancy-enum.js'
import type { Intent }  from './intent-fancy-enum.js'
import type { FileBoxInterface } from 'file-box'

const payloadText      = (text: string)     => ({ text })
const payloadSay       = (text: string, conversation: string, mentions: string[] = []) => ({ conversation, mentions, text })

const payloadAbort     = (reason: string) => ({ reason })
const payloadReset     = (reason: string) => ({ reason })
const payloadCancel    = (reason: string) => ({ reason })
const payloadData      = (data: any) => ({ data })

const payloadFeedbacks  = (feedbacks: { [contactId: string]: string }) => ({ feedbacks })
const payloadFeedback  = (contactId: string, feedback: string) => ({ contactId, feedback })

const payloadMinute = (minutes: string) => ({ minutes })

const payloadContacts   = (contacts: PUPPET.payloads.Contact[])  => ({ contacts })
export const MENTION    = createAction(Type.MENTION,   payloadContacts)()
export const CONTACTS   = createAction(Type.CONTACTS,  payloadContacts)()
export const ATTENDEES  = createAction(Type.ATTENDEES, payloadContacts)()
export const ADMINS     = createAction(Type.ADMINS,    payloadContacts)()
export const CHAIRS     = createAction(Type.CHAIRS,    payloadContacts)()

const payloadMessage  = (message: PUPPET.payloads.Message) => ({ message })
export const MESSAGE  = createAction(Type.MESSAGE, payloadMessage)()

export const BACK        = createAction(Type.BACK)()
export const NEXT        = createAction(Type.NEXT)()

export const NO_AUDIO    = createAction(Type.NO_AUDIO)()
export const NO_MENTION  = createAction(Type.NO_MENTION)()

const payloadRoom = (room: PUPPET.payloads.Room) => ({ room })
export const ROOM = createAction(Type.ROOM, payloadRoom)()

export const START       = createAction(Type.START)()
export const STOP        = createAction(Type.STOP)()

export const NO_TEXT     = createAction(Type.NO_TEXT)()
export const TEXT        = createAction(Type.TEXT, payloadText)()
export const SAY         = createAction(Type.SAY, payloadSay)()

export const FEEDBACKS    = createAction(Type.FEEDBACKS, payloadFeedbacks)()
export const FEEDBACK     = createAction(Type.FEEDBACK, payloadFeedback)()

export const CANCEL  = createAction(Type.CANCEL, payloadCancel)()
export const ABORT  = createAction(Type.ABORT, payloadAbort)()

const payloadGerror = (gerror: string) => ({ gerror })
export const GERROR = createAction(Type.GERROR, payloadGerror)()

export const RESET  = createAction(Type.RESET, payloadReset)()

const payloadIntents = (intents: readonly Intent[]) => ({ intents })
export const INTENTS = createAction(Type.INTENTS, payloadIntents)()

/**
 * Complete v.s. Finish
 *  @see https://ejoy-english.com/blog/complete-vs-finish-similar-but-different/
 */
export const FINISH   = createAction(Type.FINISH, payloadData)()
export const COMPLETE = createAction(Type.COMPLETE, payloadData)()

export const INTRODUCE  = createAction(Type.INTRODUCE)()
export const REPORT     = createAction(Type.REPORT)()

const payloadIdle = (data?: string) => ({ reason: data })
export const IDLE = createAction(Type.IDLE, payloadIdle)()

export const CHECK = createAction(Type.CHECK)()

export const PROCESS = createAction(Type.PROCESS)()
export const PARSE = createAction(Type.PARSE)()

const payloadNotice = (notice: string) => ({ notice })
export const NOTICE = createAction(Type.NOTICE, payloadNotice)()

export const MINUTE = createAction(Type.MINUTE, payloadMinute)()

const payloadConversation = (conversationId: string) => ({ conversationId })
export const CONVERSATION = createAction(Type.CONVERSATION, payloadConversation)()

export const NOP = createAction(Type.NOP)()

const payloadFileBox  = (fileBox: FileBoxInterface) => ({ fileBox })
export const FILE_BOX = createAction(Type.FILE_BOX, payloadFileBox)()

const payloadLoad = (id: string) => ({ id })
export const LOAD = createAction(Type.LOAD, payloadLoad)()
