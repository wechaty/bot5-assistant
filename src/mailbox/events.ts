/* eslint-disable sort-keys */
import {
  createAction,
}                 from 'typesafe-actions'
import type {
  AnyEventObject,
}                 from 'xstate'

import { Types }  from './types.js'

const payloadChildBusy  = (info?: string) => ({ info })
const payloadDispatch   = (info?: string) => ({ info })
const payloadNewMessage = (info?: string) => ({ info })
const payloadReset      = (info?: string) => ({ info })

const payloadChildIdle  = (info?: string) => ({ info })
const payloadDeadLetter = (event: AnyEventObject, info?: string,) => ({ event, info })

const Events = {
  /**
   * IDLE is the most important event for Mailbox actor:
   *  it must be send whenever the child machine is idle.
   *  so that the Mailbox can be able to send messages to the child machine
   */
  CHILD_IDLE: createAction(Types.CHILD_IDLE, payloadChildIdle)(),

  CHILD_BUSY  : createAction(Types.CHILD_BUSY, payloadChildBusy)(),
  DISPATCH    : createAction(Types.DISPATCH, payloadDispatch)(),
  NEW_MESSAGE : createAction(Types.NEW_MESSAGE, payloadNewMessage)(),

  RESET       : createAction(Types.RESET, payloadReset)(),
  DEAD_LETTER : createAction(Types.DEAD_LETTER, payloadDeadLetter)(),
} as const

type Event = ReturnType<typeof Events[keyof typeof Events]>

export {
  type Event,
  Events,
}
