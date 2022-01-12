/* eslint-disable sort-keys */
import {
  actions,
  SendActionOptions,
}                         from 'xstate'

import { Events }         from './events.js'
import { isMailboxType }  from './types.js'
import * as contexts      from './contexts.js'

const idle = (name: string) => (info: string) => {
  const moduleName = `${name}<Mailbox>`

  return actions.choose([
    {
      /**
       * If the transition event is a Mailbox type events (system messages):
       *  then do not trigger DISPATCH event
       *  because only non-mailbox-type events need to check QUEUE
       */
      cond: (_, e) => isMailboxType(e.type),
      actions: [
        actions.log((_, e) => `actions.idle [${e.type}] is MailboxType: skipped`, moduleName),
      ],
    },
    {
      /**
       * send CHILD_IDLE event to the mailbox for receiving new messages
       */
      actions: [
        actions.log((_, _e) => `actions.idle [CHILD_IDLE(${info})]`, moduleName),
        actions.sendParent(_ => Events.CHILD_IDLE(info)),
      ],
    },
  ]) as any
}

/**
 * Huan(202112): for child, respond the mailbox implict or explicit?
 *
 *  1. implict: all events are sent to the mailbox and be treated as the reply to the current message
 *  2. explicit: only the events that are explicitly sent to the mailbox via `sendParent`, are treated as the reply to the current message
 *
 * Current: explicit. (see: contexts.respondChildMessage)
 */
const reply: typeof actions.sendParent = (event, options) => {
  /**
   * Huan(202201): Issue #11 - Race condition: Mailbox think the target machine is busy when it's not
   * @link https://github.com/wechaty/bot5-assistant/issues/11
   *
   * add a `delay:0` when sending reply events to put the send action to the next tick
   */
  const normalizedOptions: SendActionOptions<any, any> = {
    delay: 0,
    ...options,
  }

  if (typeof event === 'function') {
    return actions.sendParent(
      (ctx, e, meta) => Events.CHILD_REPLY(event(ctx, e, meta)),
      normalizedOptions,
    )
  } else if (typeof event === 'string') {
    return actions.sendParent(
      Events.CHILD_REPLY({ type: event }),
      normalizedOptions,
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
      normalizedOptions,
    )
  }
}

/**
 * Send events to child except:
 *  1. Mailbox type
 *  2. send from Child
 */
const proxyToChild = (name: string) => (childId: string) => {
  const moduleName = `Mailbox<${name}>`
  return actions.choose([
    {
      // 1. Mailbox.Types.* is system messages, skip them
      cond: (_, e) => isMailboxType(e.type),
      actions: [],  // skip
    },
    {
      // 2. Child events (origin from child machine) are handled by child machine, skip them
      cond: (_, __, meta) => contexts.condEventSentFromChildOf(childId)(meta),
      actions: [],  // skip
    },
    {
      actions: [
        actions.send((_, e) => e, { to: childId }),
        actions.log((_, e, { _event }) => `actions.proxyToChild [${e.type}]@${_event.origin || ''} -> ${childId}`, moduleName),
      ],
    },
  ])
}

const Actions = {
  idle,
  reply,
  proxyToChild,
}

export {
  Actions,
}
