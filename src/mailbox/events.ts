/* eslint-disable sort-keys */
import {
  createAction,
}                 from 'typesafe-actions'
import type {
  AnyEventObject,
}                 from 'xstate'

import { Types }  from './types.js'

const payloadBusy       = (info?: string) => ({ info })
const payloadSend       = (info?: string) => ({ info })
const payloadIdle       = (info?: string) => ({ info })
const payloadMessage    = (info?: string) => ({ info })
const payloadReset      = (info?: string) => ({ info })

const payloadReceive    = (info?: string) => ({ info })
const payloadDeadLetter = (event: AnyEventObject, info?: string,) => ({ event, info })

const Events = {
  /**
   * IDLE is the most important event for Mailbox actor:
   *  it must be send whenever the child machine is idle.
   *  so that the Mailbox can be able to send messages to the child machine
   */
  IDLE: createAction(Types.IDLE, payloadIdle)(),

  BUSY     : createAction(Types.BUSY, payloadBusy)(),
  SEND : createAction(Types.SEND, payloadSend)(),
  MESSAGE   : createAction(Types.MESSAGE, payloadMessage)(),
  RESET    : createAction(Types.RESET, payloadReset)(),

  RECEIVE     : createAction(Types.RECEIVE, payloadReceive)(),
  DEAD_LETTER : createAction(Types.DEAD_LETTER, payloadDeadLetter)(),
} as const

type Event = ReturnType<typeof Events[keyof typeof Events]>

export {
  type Event,
  Events,
}
