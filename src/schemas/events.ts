/* eslint-disable sort-keys */
import {
  createAction,
  isActionOf,
  isOfType,
  // createAsyncAction,
}                         from 'typesafe-actions'
import type {
  Message,
  Contact,
  Room,
  Wechaty,
}               from 'wechaty'

import { Types } from './types.js'

// type RemoveType<T extends (...args: any[]) => {}> = (...args: Parameters<T>) => Omit<ReturnType<T>, 'type'>
// type RemoveAllType<T extends {
//   [key: string]: (...args: any[]) => any
// }> = {
//   [K in keyof T]: RemoveType<T[K]>
// }

const payloadMentions  = (mentions: Contact[]) => ({ mentions })
const payloadMessage   = (message: Message) => ({ message })

const payloadRoom      = (room: Room) => ({ room })
const payloadContacts  = (contacts: Contact[]) => ({ contacts })

const payloadText      = (text: string)     => ({ text })
const payloadSay       = (text: string, conversation: string, mentions: string[]) => ({ conversation, mentions, text })
const payloadWechaty   = (wechaty: Wechaty) => ({ wechaty })
const payloadWechatyAddress   = (address: string) => ({ address })

const payloadAbort     = (reason: string) => ({ reason })
const payloadReset     = (reason: string) => ({ reason })
const payloadCancel    = (reason: string) => ({ reason })
const payloadError     = (gerror: string) => ({ gerror })
const payloadData      = (data: any) => ({ data })

const payloadFeedback  = (feedbacks: { [contactId: string]: string }) => ({ feedbacks })

const payloadEmpty     = () => ({})

const Events = {
  MENTIONS   : createAction(Types.MENTIONS, payloadMentions)(),
  MESSAGE    : createAction(Types.MESSAGE, payloadMessage)(),
  NEXT       : createAction(Types.NEXT, payloadEmpty)(),
  NO_AUDIO   : createAction(Types.NO_AUDIO, payloadEmpty)(),
  NO_MENTION : createAction(Types.NO_MENTION, payloadEmpty)(),

  ROOM       : createAction(Types.ROOM, payloadRoom)(),
  CONTACTS   : createAction(Types.CONTACTS, payloadContacts)(),
  ADMINS     : createAction(Types.ADMINS, payloadContacts)(),

  START      : createAction(Types.START, payloadEmpty)(),
  STOP       : createAction(Types.STOP, payloadEmpty)(),

  TEXT       : createAction(Types.TEXT, payloadText)(),
  SAY        : createAction(Types.SAY, payloadSay)(),

  FEEDBACK   : createAction(Types.FEEDBACK, payloadFeedback)(),

  CANCEL : createAction(Types.CANCEL, payloadCancel)(),
  ABORT : createAction(Types.ABORT, payloadAbort)(),
  ERROR : createAction(Types.ERROR, payloadError)(),
  RESET : createAction(Types.RESET, payloadReset)(),

  // WAKEUP : createAction(Types.WAKEUP, payloadEmpty)(),
  // CHECK  : createAction(Types.CHECK, payloadEmpty)(),

  WECHATY : createAction(Types.WECHATY, payloadWechaty)(),
  WECHATY_ADDRESS : createAction(Types.WECHATY_ADDRESS, payloadWechatyAddress)(),

  /**
   * Complete v.s. Finish
   *  @see https://ejoy-english.com/blog/complete-vs-finish-similar-but-different/
   */
  FINISH : createAction(Types.FINISH, payloadData)(),
  COMPLETE : createAction(Types.COMPLETE, payloadData)(),
} as const

type Event = ReturnType<typeof Events[keyof typeof Events]>

// const payloads = {
//   ATTENDEES  : payloadAttendees,
//   MENTIONS   : payloadMentions,
//   MESSAGE    : payloadMessage,
//   NEXT       : payloadEmpty,
//   NO_AUDIO   : payloadEmpty,
//   NO_MENTION : payloadEmpty,

//   RESET: payloadEmpty,
//   ABORTED: payloadAbort,
//   CANCEL :payloadCancel,
//   ERROR  :payloadError,

//   ROOM       : payloadRoom,
//   SAY        : payloadSay,

//   START      : payloadEmpty,
//   STOP: payloadEmpty,

//   TEXT       : payloadText,
//   WAKEUP : payloadEmpty,
//   CHECK: payloadEmpty,

//   COMPLETE: payloadData,
//   FINISH: payloadData,

//   WECHATY: payloadWechaty,
// } as const

export {
  Events,
  type Event,
}
