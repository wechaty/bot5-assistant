import {
  createAction,
}                 from 'typesafe-actions'
import type {
  EventObject,
}                 from 'xstate'

import * as types         from './types.js'
import type * as contexts from './contexts.js'

const payloadDispatch = (reason?: string) => ({ reason })
const payloadIdle  = (reason?: string) => ({ reason })
const payloadBusy  = (reason?: string) => ({ reason })
const payloadReset = () => ({})
const payloadNotify = (reason?: string) => ({ reason })

const DISPATCH = createAction(types.DISPATCH, payloadDispatch)()
const IDLE  = createAction(types.IDLE, payloadIdle)()
const BUSY = createAction(types.BUSY, payloadBusy)()
const RESET = createAction(types.RESET, payloadReset)()
const NOTIFY = createAction(types.NOTIFY, payloadNotify)()

type Event =
  | ReturnType<typeof DISPATCH>
  | ReturnType<typeof IDLE>
  | ReturnType<typeof BUSY>
  | ReturnType<typeof RESET>
  | ReturnType<typeof NOTIFY>

// TODO: remove any
const condCurrentEventTypeIsMailbox = (ctx: contexts.Context) => {
  /**
   * Return `true` if there's no currentEvent at all
   *  to skip other logics to prevent error
   *
   * TODO: add warning log at here?
   */
  if (!ctx.currentEvent) {
    console.warn('ctx.currentEvent is empty!')
    return true
  }

  return Object
    .values(types)
    .includes(ctx.currentEvent.type as any)
}

export {
  type Event,
  condCurrentEventTypeIsMailbox,
  DISPATCH,
  IDLE,
  BUSY,
  RESET,
  NOTIFY,
}
