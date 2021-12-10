/* eslint-disable sort-keys */
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
const STOP     = createAction(types.STOP, payloadEmpty)()

const TEXT       = createAction(types.TEXT, payloadText)()
const SAY        = createAction(types.SAY, payloadSay)()
const CANCEL = createAction(types.CANCEL, payloadCancel)()
const ABORT = createAction(types.ABORT, payloadAbort)()
const RESET = createAction(types.RESET, payloadEmpty)()
const WAKEUP = createAction(types.WAKEUP, payloadEmpty)()

/**
 * Complete v.s. Finish
 *  @see https://ejoy-english.com/blog/complete-vs-finish-similar-but-different/
 */
const FINISH = createAction(types.FINISH, payloadData)()
const COMPLETE = createAction(types.COMPLETE, payloadData)()

const payloads = {
  ABORTED: payloadAbort,
  ATTENDEES  : payloadAttendees,
  CANCEL :payloadCancel,
  MENTIONS   : payloadMentions,
  MESSAGE    : payloadMessage,
  NEXT       : payloadEmpty,
  NO_AUDIO   : payloadEmpty,
  NO_MENTION : payloadEmpty,
  RESET: payloadEmpty,
  ROOM       : payloadRoom,
  SAY        : payloadSay,

  START      : payloadEmpty,
  STOP: payloadEmpty,

  TEXT       : payloadText,
  WAKEUP : payloadEmpty,

  COMPLETE: payloadData,
  FINISH: payloadData,
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
  STOP,

  TEXT,
  WAKEUP,

  COMPLETE,
  FINISH,
}
