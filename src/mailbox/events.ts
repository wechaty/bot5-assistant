/* eslint-disable sort-keys */
import {
  createAction,
}                 from 'typesafe-actions'
import type {
  AnyEventObject,
  EventObject,
}                 from 'xstate'

import { Types }  from './types.js'
import type * as contexts from './contexts.js'

/**
 * paload of: child
 */
const payloadChildIdle  = (debug?: string)         => ({ debug })
const payloadChildReply = (message: EventObject)  => ({ message })

/**
 * payload of: queue
 */
const payloadNewMessage = (debug?: string) => ({ debug })
const payloadDispatch   = (debug?: string) => ({ debug })
const payloadDequeue    = (message: contexts.AnyEventObjectExt) => ({ message })

/**
 * payload of: debugging
 */
const payloadReset      = (debug?: string) => ({ debug })
const payloadDeadLetter = (message: AnyEventObject, debug?: string) => ({ message, debug })

const Events = {
  /**
   * events of: child
   *
   * IDLE is the most important event for Mailbox actor:
   *  it must be send whenever the child machine is idle.
   *  so that the Mailbox can be able to send messages to the child machine
   */
  CHILD_IDLE  : createAction(Types.CHILD_IDLE,  payloadChildIdle)(),
  CHILD_REPLY : createAction(Types.CHILD_REPLY, payloadChildReply)(),

  /**
   * events of: queue
   */
  NEW_MESSAGE : createAction(Types.NEW_MESSAGE, payloadNewMessage)(),
  DISPATCH    : createAction(Types.DISPATCH, payloadDispatch)(),
  DEQUEUE     : createAction(Types.DEQUEUE, payloadDequeue)(),

  /**
   * events for : debugging
   */
  RESET       : createAction(Types.RESET, payloadReset)(),
  DEAD_LETTER : createAction(Types.DEAD_LETTER, payloadDeadLetter)(),
} as const

type Event = ReturnType<typeof Events[keyof typeof Events]>

export {
  type Event,
  Events,
}
