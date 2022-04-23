/* eslint-disable sort-keys */
import * as CQRS      from 'wechaty-cqrs'
import * as Mailbox   from 'mailbox'

import * as duck            from '../../duck/mod.js'

export interface Context {
  conversationId?: string,
  address: {
    wechaty: string,
  },
}

const duckula = Mailbox.duckularize({
  id: 'Noticing',
  events: [ { ...duck.Event, ...CQRS.duck.actions }, [
    /**
     * Requests
     */
    'NOTICE',
    'CONVERSATION',
  ] ],
  states: [ duck.State, [
    'Initializing',
    'Idle',
    'Noticing',
  ] ],
  initialContext: ({}) as Context,
})

export type Event = ReturnType<typeof duckula.Event[keyof typeof duckula.Event]>
export type Events = {
  [key in keyof typeof duckula.Event]: ReturnType<typeof duckula.Event[key]>
}

export default duckula
