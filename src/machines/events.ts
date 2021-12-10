import {
  createAction,
  // createAsyncAction,
}                         from 'typesafe-actions'
import type {
  Message,
  Contact,
  Room,
}               from 'wechaty'

import * as types from './types.js'

// type RemoveType<T extends (...args: any[]) => {}> = (...args: Parameters<T>) => Omit<ReturnType<T>, 'type'>
// type RemoveAllType<T extends {
//   [key: string]: (...args: any[]) => any
// }> = {
//   [K in keyof T]: RemoveType<T[K]>
// }

const payloadAttendees = (attendees: Contact[]) => ({ attendees })
const payloadMentions  = (mentions: Contact[]) => ({ mentions })
const payloadMessage   = (message: Message) => ({ message })
const payloadRoom      = (room: Room) => ({ room })
const payloadText      = (text: string)     => ({ text })
const payloadSay       = (text: string, mentions: Contact[]) => ({ mentions, text })
const payloadAbort     = (error: string) => ({ error })
const payloadCancel    = (error: string) => ({ error })

const payloadEmpty     = () => ({})
const payloadNoAudio   = payloadEmpty
const payloadNoMention = payloadEmpty
const payloadNext      = payloadEmpty
const payloadStart     = payloadEmpty
const payloadReset     = payloadEmpty

const ATTENDEES  = createAction(types.ATTENDEES, payloadAttendees)()
const MENTIONS   = createAction(types.MENTIONS, payloadMentions)()
const MESSAGE    = createAction(types.MESSAGE, payloadMessage)()
const NEXT       = createAction(types.NEXT, payloadNext)()
const NO_AUDIO   = createAction(types.NO_AUDIO, payloadNoAudio)()
const NO_MENTION = createAction(types.NO_MENTION, payloadNoMention)()
const ROOM       = createAction(types.ROOM, payloadRoom)()
const START      = createAction(types.START, payloadStart)()
const TEXT       = createAction(types.TEXT, payloadText)()
const SAY        = createAction(types.SAY, payloadSay)()
const CANCEL = createAction(types.CANCEL, payloadCancel)()
const ABORT = createAction(types.ABORT, payloadAbort)()
const RESET = createAction(types.RESET, payloadReset)()

const payloads = {
  ABORTED: payloadAbort,
  ATTENDEES  : payloadAttendees,
  CANCEL :payloadCancel,
  MENTIONS   : payloadMentions,
  MESSAGE    : payloadMessage,
  NEXT       : payloadNext,
  NO_AUDIO   : payloadNoAudio,
  NO_MENTION : payloadNoMention,
  RESET: payloadReset,
  ROOM       : payloadRoom,
  SAY        : payloadSay,
  START      : payloadStart,
  TEXT       : payloadText,
}

export {
  payloads,
  ABORT,
  ATTENDEES,
  CANCEL,
  MENTIONS,
  MESSAGE,
  NEXT,
  NO_AUDIO,
  NO_MENTION,
  ROOM,
  RESET,
  SAY,
  START,
  TEXT,
}
