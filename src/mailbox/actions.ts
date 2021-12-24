/* eslint-disable sort-keys */
import { actions } from 'xstate'

import { Events } from './events.js'
import { isMailboxType } from './types.js'

const sendChildProxy = (childId: string) => actions.choose([
  {
    /**
     * Ignore all Mailbox.Types (system messages): those events is for controling Mailbox only
     *  do not proxy/forward them to child
     */
    cond: (_, e) => isMailboxType(e.type),
    actions: [],
  },
  {
    /**
     * Send all other events to child
     */
    actions: actions.send((_, e) => e, { to: childId }),
  },
])

const receive = (info: string) => actions.choose([
  {
    /**
     * Ignore all Mailbox type events (system messages):
     *  those events is for controling Mailbox only
     */
    cond: (_, e) => isMailboxType(e.type),
    actions: [],
  },
  {
    /**
     * send RECEIVE event to the mailbox for receiving new messages
     */
    actions: actions.sendParent(_ => {
      return Events.RECEIVE(info)
    }),
  },
])

const Actions = {
  receive,
  sendChildProxy,
}

export {
  Actions,
}
