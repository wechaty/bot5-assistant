/* eslint-disable sort-keys */
import {
  createAction,
}                 from 'typesafe-actions'
import type {
  AnyEventObject,
}                 from 'xstate'

import { Types }  from './types.js'
import type * as contexts from './contexts.js'

/**
 * paload of: child
 */
const payloadChildIdle  = (info?: string) => ({ info })

/**
 * payload of: queue
 */
const payloadDispatch   = (info?: string) => ({ info })
const payloadEnqueue = (message: contexts.AnyEventObjectExt) => ({ message })
const payloadDequeue = (message: contexts.AnyEventObjectExt) => ({ message })

/**
 * payload of: debugging
 */
const payloadReset      = (info?: string) => ({ info })
const payloadDeadLetter = (event: AnyEventObject, info?: string,) => ({ event, info })

const Events = {
  /**
   * events of: child
   *
   * IDLE is the most important event for Mailbox actor:
   *  it must be send whenever the child machine is idle.
   *  so that the Mailbox can be able to send messages to the child machine
   */
  CHILD_IDLE: createAction(Types.CHILD_IDLE, payloadChildIdle)(),

  /**
   * events of: queue
   */
  DISPATCH : createAction(Types.DISPATCH, payloadDispatch)(),
  ENQUEUE  : createAction(Types.ENQUEUE, payloadEnqueue)(),
  DEQUEUE  : createAction(Types.DEQUEUE, payloadDequeue)(),

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
