/* eslint-disable sort-keys */
import * as CQRS      from 'wechaty-cqrs'
import * as Mailbox   from 'mailbox'

import * as duck            from '../../duck/mod.js'

export interface Context {
  conversationId?: string,
  address?: {
    wechaty: string,
  },
}

const duckula = Mailbox.duckularize({
  id: 'Noticing',
  events: [ { ...duck.Event, ...CQRS.commands }, [
    'CONVERSATION',
    'IDLE',
    'NOTICE',
    'SendMessageCommand',
  ] ],
  states: [ duck.State, [
    'Idle',
    'Initializing',
    'Noticing',
    'Responding',
  ] ],
  initialContext: ({}) as Context,
})

export default duckula
