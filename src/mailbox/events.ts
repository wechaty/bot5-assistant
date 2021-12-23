/* eslint-disable sort-keys */
import {
  createAction,
}                 from 'typesafe-actions'
import type {
  AnyEventObject,
}                 from 'xstate'

import { Types }  from './types.js'

const payloadDispatch = (reason?: string) => ({ reason })
const payloadIdle     = (reason?: string) => ({ reason })
const payloadBusy     = (reason?: string) => ({ reason })
const payloadReset    = () => ({})
const payloadNotify   = (reason?: string) => ({ reason })
const payloadDeadLetter = (reason: string, event: AnyEventObject) => ({ reason, event })

const Events = {
  /**
   * IDLE is the most important event for Mailbox actor:
   *  it must be send whenever the child machine is idle.
   *  so that the Mailbox can be able to send messages to the child machine
   */
  IDLE: createAction(Types.IDLE, payloadIdle)(),

  BUSY     : createAction(Types.BUSY, payloadBusy)(),
  DISPATCH : createAction(Types.DISPATCH, payloadDispatch)(),
  NOTIFY   : createAction(Types.NOTIFY, payloadNotify)(),
  RESET    : createAction(Types.RESET, payloadReset)(),
  DEAD_LETTER: createAction(Types.DEAD_LETTER, payloadDeadLetter)(),
} as const

type Event = ReturnType<typeof Events[keyof typeof Events]>

export {
  type Event,
  Events,
}
