/* eslint-disable sort-keys */
import { actions } from 'xstate'

import { Events } from './events.js'
import { isMailboxType } from './types.js'

const sendChildProxy = (childId: string) => {
  return actions.choose([
    /**
     * Ignore all Mailbox.Types: those events is for controling Mailbox only
     *  do not proxy/forward them to child
     */
    {
      cond: (_, e) => isMailboxType(e.type),
      actions: [],
    },
    /**
     * Send all other events to child
     */
    {
      actions: actions.send((_, e) => e, { to: childId }),
    },
  ])
}

const Actions = {
  sendParentIdle: (info: string) => actions.sendParent(Events.IDLE(info)),
  sendChildProxy,
}

export {
  Actions,
}
