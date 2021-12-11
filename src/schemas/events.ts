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
const payloadSay       = (text: string, conversation: string, mentions: string[]) => ({ conversation, mentions, text })
const payloadWechaty  = (wechaty: Wechaty) => ({ wechaty })

const payloadAbort     = (reason: string) => ({ reason })
const payloadReset     = (reason: string) => ({ reason })
const payloadCancel    = (reason: string) => ({ reason })
const payloadError     = (error: string) => ({ error })
const payloadData      = (data: any) => ({ data })

const payloadEmpty     = () => ({})

const ATTENDEES  = createAction(types.ATTENDEES, payloadAttendees)()
const MENTIONS   = createAction(types.MENTIONS, payloadMentions)()
const MESSAGE    = createAction(types.MESSAGE, payloadMessage)()
const NEXT       = createAction(types.NEXT, payloadEmpty)()
const NO_AUDIO   = createAction(types.NO_AUDIO, payloadEmpty)()
const NO_MENTION = createAction(types.NO_MENTION, payloadEmpty)()
const ROOM       = createAction(types.ROOM, payloadRoom)()

const START      = createAction(types.START, payloadEmpty)()
const STOP       = createAction(types.STOP, payloadEmpty)()

const TEXT       = createAction(types.TEXT, payloadText)()
const SAY        = createAction(types.SAY, payloadSay)()

const CANCEL = createAction(types.CANCEL, payloadCancel)()
const ABORT = createAction(types.ABORT, payloadAbort)()
const ERROR = createAction(types.ERROR, payloadError)()
const RESET = createAction(types.RESET, payloadReset)()

const WAKEUP = createAction(types.WAKEUP, payloadEmpty)()

const WECHATY = createAction(types.WECHATY, payloadWechaty)()

/**
 * Complete v.s. Finish
 *  @see https://ejoy-english.com/blog/complete-vs-finish-similar-but-different/
 */
const FINISH = createAction(types.FINISH, payloadData)()
const COMPLETE = createAction(types.COMPLETE, payloadData)()

const payloads = {
  ATTENDEES  : payloadAttendees,
  MENTIONS   : payloadMentions,
  MESSAGE    : payloadMessage,
  NEXT       : payloadEmpty,
  NO_AUDIO   : payloadEmpty,
  NO_MENTION : payloadEmpty,

  RESET: payloadEmpty,
  ABORTED: payloadAbort,
  CANCEL :payloadCancel,
  ERROR  :payloadError,

  ROOM       : payloadRoom,
  SAY        : payloadSay,

  START      : payloadEmpty,
  STOP: payloadEmpty,

  TEXT       : payloadText,
  WAKEUP : payloadEmpty,

  COMPLETE: payloadData,
  FINISH: payloadData,

  WECHATY: payloadWechaty,
}

export {
  payloads,
  ATTENDEES,
  MENTIONS,
  ROOM,
  MESSAGE,
  NEXT,
  NO_AUDIO,
  NO_MENTION,

  ABORT,
  CANCEL,
  RESET,
  ERROR,

  SAY,

  START,
  STOP,

  TEXT,
  WAKEUP,

  COMPLETE,
  FINISH,

  WECHATY,
}
