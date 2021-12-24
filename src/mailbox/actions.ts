/* eslint-disable sort-keys */
import { actions } from 'xstate'

import { Events } from './events.js'
import { isSystemType } from './types.js'

const sendChildProxy = (childId: string) => actions.choose([
  /**
   * Ignore all Mailbox.Types: those events is for controling Mailbox only
   *  do not proxy/forward them to child
   */
  {
    cond: (_, e) => isSystemType(e.type),
    actions: [],
  },
  /**
   * Send all other events to child
   */
  {
    actions: actions.send((_, e) => e, { to: childId }),
  },
])

const receive = (info: string) => actions.choose([
  {
    /**
     * Ignore all Mailbox events: those events is for controling Mailbox only
     */
    cond: (_, e) => isSystemType(e.type),
    actions: [],
  },
  {
    /**
     * Otherwise, ask Mailbox for receiving new messages
     */
    actions: actions.sendParent(_ => Events.IDLE(info)),
  },
])

const Actions = {
  receive,
  sendChildProxy,
}

export {
  Actions,
}
