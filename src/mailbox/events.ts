import {
  createAction,
}                 from 'typesafe-actions'
import type {
  EventObject,
}                 from 'xstate'

import { Types }  from './types.js'
import type * as contexts from './contexts.js'

const payloadDispatch = (reason?: string) => ({ reason })
const payloadIdle  = (reason?: string) => ({ reason })
const payloadBusy  = (reason?: string) => ({ reason })
const payloadReset = () => ({})
const payloadNotify = (reason?: string) => ({ reason })

const Events = {
  BUSY     : createAction(Types.BUSY, payloadBusy)(),
  DISPATCH : createAction(Types.DISPATCH, payloadDispatch)(),
  IDLE     : createAction(Types.IDLE, payloadIdle)(),
  NOTIFY   : createAction(Types.NOTIFY, payloadNotify)(),
  RESET    : createAction(Types.RESET, payloadReset)(),
} as const

type Event = ReturnType<typeof Events[keyof typeof Events]>

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
    .values(Types)
    .includes(ctx.currentEvent.type as any)
}

export {
  type Event,
  Events,
  condCurrentEventTypeIsMailbox,
}
