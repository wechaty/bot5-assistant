/* eslint-disable sort-keys */
import * as Mailbox   from 'mailbox'
import * as CQRS      from 'wechaty-cqrs'

import * as ACTOR   from '../../wechaty-actor/mod.js'
import * as duck    from '../../duck/mod.js'

export interface Context {
  address?: {
    wechaty: string,
  }
}

const duckula = Mailbox.duckularize({
  id: 'MessageToFile',
  events: [ { ...duck.Event, ...CQRS.duck.actions, ...ACTOR.Event }, [
    /**
     * Request
     */
    'MESSAGE',
    /**
     * Response
     */
    'CONTACTS',
    /**
     * Internal
     */
    'GERROR',
    'LOAD',
    'GET_CONTACT_PAYLOAD_QUERY_RESPONSE',
    'BATCH_RESPONSE',
  ] ],
  states: [ duck.State, [
    'Erroring',
    'Idle',
    'Loading',
    'Messaging',
    'Responding',
  ] ],
  initialContext: {} as Context,
})

export default duckula
