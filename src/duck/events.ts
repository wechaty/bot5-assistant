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

const payloadOptionalMessage = (message?: PUPPET.payloads.Message) => ({ message })

const payloadSay       = (text: string, conversation: string, mentions: string[] = []) => ({ conversation, mentions, text })

const payloadAbort     = (reason: string) => ({ reason })
const payloadCancel    = (reason: string) => ({ reason })
const payloadData      = (data?: string) => ({ data })

const payloadMentions = (contacts: PUPPET.payloads.Contact[], message?: PUPPET.payloads.Message) => ({ contacts, message })
export const MENTIONS = createAction(Type.MENTIONS, payloadMentions)()
export const NO_MENTION  = createAction(Type.NO_MENTION)()

const payloadContacts   = (contacts: PUPPET.payloads.Contact[])  => ({ contacts })
export const CONTACTS   = createAction(Type.CONTACTS,  payloadContacts)()
export const NO_CONTACT  = createAction(Type.NO_CONTACT)()
export const ADD_CONTACT = createAction(Type.ADD_CONTACT, payloadContacts)()

export const ATTENDEES  = createAction(Type.ATTENDEES, payloadContacts)()
export const ADMINS     = createAction(Type.ADMINS,    payloadContacts)()
export const CHAIRS     = createAction(Type.CHAIRS,    payloadContacts)()

const payloadMessage  = (message: PUPPET.payloads.Message) => ({ message })
export const MESSAGE  = createAction(Type.MESSAGE, payloadMessage)()

export const BACK        = createAction(Type.BACK)()
export const NEXT        = createAction(Type.NEXT)()

export const NO_AUDIO    = createAction(Type.NO_AUDIO)()

const payloadRoom = (room: PUPPET.payloads.Room, message?: PUPPET.payloads.Message) => ({ message, room })
export const ROOM = createAction(Type.ROOM, payloadRoom)()

const payloadNoRoom = (message?: PUPPET.payloads.Message) => ({ message })
export const NO_ROOM = createAction(Type.NO_ROOM, payloadNoRoom)()

export const START       = createAction(Type.START)()
export const STOP        = createAction(Type.STOP)()

const  payloadText   = (text: string, message?: PUPPET.payloads.Message) => ({ message, text })
export const TEXT    = createAction(Type.TEXT,    payloadText)()
export const NO_TEXT = createAction(Type.NO_TEXT, payloadOptionalMessage)()

export const SAY         = createAction(Type.SAY, payloadSay)()

const payloadFeedbacks  = (feedbacks: { [contactId: string]: string }) => ({ feedbacks })
export const FEEDBACKS    = createAction(Type.FEEDBACKS, payloadFeedbacks)()

// const payloadFeedback = (feedback: string, message: PUPPET.payloads.Message) => ({ feedback, message })
// export const FEEDBACK = createAction(Type.FEEDBACK, payloadFeedback)()

export const CANCEL  = createAction(Type.CANCEL, payloadCancel)()
export const ABORT  = createAction(Type.ABORT, payloadAbort)()

const payloadGerror = (gerror: string) => ({ gerror })
export const GERROR = createAction(Type.GERROR, payloadGerror)()

const payloadReset  = (data?: string) => ({ data })
export const RESET  = createAction(Type.RESET, payloadReset)()

const payloadIntents = (intents: readonly Intent[], message?: PUPPET.payloads.Message) => ({ intents, message })
export const INTENTS = createAction(Type.INTENTS, payloadIntents)()

/**
 * Complete v.s. Finish
 *  @see https://ejoy-english.com/blog/complete-vs-finish-similar-but-different/
 */
export const FINISH   = createAction(Type.FINISH, payloadData)()
export const COMPLETE = createAction(Type.COMPLETE, payloadData)()

export const HELP  = createAction(Type.HELP)()
export const REPORT     = createAction(Type.REPORT)()

const payloadIdle = (data?: string) => ({ reason: data })
export const IDLE = createAction(Type.IDLE, payloadIdle)()

export const CHECK = createAction(Type.CHECK)()

export const PROCESS = createAction(Type.PROCESS)()
export const PARSE = createAction(Type.PARSE)()

const payloadNotice = (text: string, mentions: string[] = []) => ({ mentions, text })
export const NOTICE = createAction(Type.NOTICE, payloadNotice)()

/**
 * Minutes of Meeting (MoM)
 *  @link https://en.wikipedia.org/wiki/Minutes
 */
const payloadMinute = (minutes: string) => ({ minutes })
export const MINUTES = createAction(Type.MINUTES, payloadMinute)()

const payloadConversation = (conversationId: string) => ({ conversationId })
export const CONVERSATION = createAction(Type.CONVERSATION, payloadConversation)()

export const NOP = createAction(Type.NOP)()

const payloadFile  = (box: string, message?: PUPPET.payloads.Message) => ({ box, message })
export const FILE = createAction(Type.FILE, payloadFile)()

const payloadNoFile  = (message?: PUPPET.payloads.Message) => ({ message })
export const NO_FILE = createAction(Type.NO_FILE, payloadNoFile)()

const payloadLoad = (id: string) => ({ id })
export const LOAD = createAction(Type.LOAD, payloadLoad)()

export const REGISTER = createAction(Type.REGISTER)()

export const payloadTalk = (contact: PUPPET.payloads.Contact, topic: string, outlines: string) => ({ contact, outlines, topic })
export const TALK = createAction(Type.TALK, payloadTalk)()

export const TEST = createAction(Type.TEST)()
