/* eslint-disable sort-keys */
import {
  createAction,
}                         from 'typesafe-actions'
import type {
  Message,
  Contact,
  Room,
  Wechaty,
}               from 'wechaty'
import type { Intent } from './intents.js'

import { Types } from './types.js'

// type RemoveType<T extends (...args: any[]) => {}> = (...args: Parameters<T>) => Omit<ReturnType<T>, 'type'>
// type RemoveAllType<T extends {
//   [key: string]: (...args: any[]) => any
// }> = {
//   [K in keyof T]: RemoveType<T[K]>
// }

const payloadMention  = (contacts: Contact[]) => ({ contacts })
const payloadMessage   = (message: Message) => ({ message })

const payloadRoom      = (room: Room) => ({ room })
const payloadContacts  = (contacts: Contact[]) => ({ contacts })

const payloadText      = (text: string)     => ({ text })
const payloadSay       = (text: string, conversation: string, mentions: string[] = []) => ({ conversation, mentions, text })
const payloadWechaty   = (wechaty: Wechaty) => ({ wechaty })
// const payloadWechatyAddress   = (address: string) => ({ address })

const payloadAbort     = (reason: string) => ({ reason })
const payloadReset     = (reason: string) => ({ reason })
const payloadCancel    = (reason: string) => ({ reason })
const payloadGerror     = (gerror: string) => ({ gerror })
const payloadData      = (data: any) => ({ data })

const payloadIntents  = (intents: readonly Intent[]) => ({ intents })

const payloadFeedbacks  = (feedbacks: { [contactId: string]: string }) => ({ feedbacks })
const payloadFeedback  = (contactId: string, feedback: string) => ({ contactId, feedback })

const payloadIntroduce = () => ({})
const payloadReport    = () => ({})

const payloadEmpty     = () => ({})
const payloadIdle = (reason?: string) => ({ reason })
const payloadCheck = () => ({})
const payloadProcess = () => ({})
const payloadParse = () => ({})
const payloadNotice = (notice: string) => ({ notice })

const Events = {
  MENTION   : createAction(Types.MENTION, payloadMention)(),
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

  FEEDBACKS   : createAction(Types.FEEDBACKS, payloadFeedbacks)(),
  FEEDBACK    : createAction(Types.FEEDBACK, payloadFeedback)(),

  CANCEL : createAction(Types.CANCEL, payloadCancel)(),
  ABORT : createAction(Types.ABORT, payloadAbort)(),
  GERROR : createAction(Types.GERROR, payloadGerror)(),
  RESET : createAction(Types.RESET, payloadReset)(),

  // WAKEUP : createAction(Types.WAKEUP, payloadEmpty)(),
  // CHECK  : createAction(Types.CHECK, payloadEmpty)(),
  INTENTS: createAction(Types.INTENTS, payloadIntents)(),

  WECHATY : createAction(Types.WECHATY, payloadWechaty)(),
  // WECHATY_ADDRESS : createAction(Types.WECHATY_ADDRESS, payloadWechatyAddress)(),

  /**
   * Complete v.s. Finish
   *  @see https://ejoy-english.com/blog/complete-vs-finish-similar-but-different/
   */
  FINISH : createAction(Types.FINISH, payloadData)(),
  COMPLETE : createAction(Types.COMPLETE, payloadData)(),

  INTRODUCE: createAction(Types.INTRODUCE, payloadIntroduce)(),
  REPORT: createAction(Types.REPORT, payloadReport)(),

  IDLE: createAction(Types.IDLE, payloadIdle)(),
  CHECK: createAction(Types.CHECK, payloadCheck)(),

  PROCESS: createAction(Types.PROCESS, payloadProcess)(),
  PARSE: createAction(Types.PARSE, payloadParse)(),
  NOTICE: createAction(Types.NOTICE, payloadNotice)(),
} as const

type EventPayloads = {
  [key in keyof typeof Events]: ReturnType<typeof Events[key]>
}

export {
  Events,
  type EventPayloads,
}
