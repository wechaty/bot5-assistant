/* eslint-disable sort-keys */
import {
  actions,
}                 from 'xstate'

import { Events }         from './events.js'
import { isMailboxType }  from './types.js'

const sendParentIdle = (info: string) => actions.choose([
  {
    /**
     * If the transition event is a Mailbox type events (system messages):
     *  then do not trigger RECEIVE event
     *  because only non-mailbox-type events need to check RECEIVE
     */
    cond: (_, e) => isMailboxType(e.type),
    actions: [
      actions.log((_, e) => `actions.sendParentIdle skip for MailboxType ${e.type}`, 'Mailbox'),
    ],
  },
  {
    /**
     * send RECEIVE event to the mailbox for receiving new messages
     */
    actions: [
      actions.log((_, e) => `actions.sendParentIdle triggered by ${e.type}`, 'Mailbox'),
      actions.sendParent(_ => Events.CHILD_IDLE(info)),
    ],
  },
]) as any

/**
 * Huan(202112): for child, respond the mailbox implict or explicit?
 *
 *  1. implict: all events are sent to the mailbox and be treated as the reply to the current message
 *  2. explicit: only the events that are explicitly sent to the mailbox via `sendParent`, are treated as the reply to the current message
 *
 * Current: explicit. (see: contexts.respondChildMessage)
 */
const reply: typeof actions.sendParent = (event, options) => {
  if (typeof event === 'function') {
    return actions.sendParent(
      (ctx, e, meta) => Events.CHILD_REPLY(event(ctx, e, meta)),
      options,
    )
  } else if (typeof event === 'string') {
    return actions.sendParent(
      Events.CHILD_REPLY({ type: event }),
      options,
    )
  } else {
    return actions.sendParent(
      /**
       * Huan(202112) FIXME: remove any
       *
       * How to fix TS2322: "could be instantiated with a different subtype of constraint 'object'"?
       *  @link https://stackoverflow.com/a/56701587/1123955
       */
      Events.CHILD_REPLY(event) as any,
      options,
    )
  }
}

const Actions = {
  sendParentIdle,
  reply,
}

export {
  Actions,
}
