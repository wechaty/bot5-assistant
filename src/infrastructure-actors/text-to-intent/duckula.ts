/* eslint-disable sort-keys */
import * as Mailbox   from 'mailbox'

import * as duck    from '../../duck/mod.js'

export interface Context {}

const duckula = Mailbox.duckularize({
  id: 'Intent',
  events: [ duck.Event, [
    /**
     * Request
     */
    'TEXT',
    /**
     * Response
     */
    'INTENTS',
    /**
     * Internal
     */
    'GERROR',
    'IDLE',
  ] ],
  states: [ duck.State, [
    'Idle',
    'Understanding',
    'Understood',
    'Erroring',
  ] ],
  initialContext: {} as Context,
})

export default duckula
