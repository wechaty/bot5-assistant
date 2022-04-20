/* eslint-disable sort-keys */
import * as Mailbox   from 'mailbox'

import * as duck    from '../../duck/mod.js'

export interface Context {}

const duckula = Mailbox.duckularize({
  id: 'Intent',
  events: [ duck.Event, [
    // request
    'TEXT',
    // response
    'INTENTS',
    // internal
    'GERROR',
    'IDLE',
  ] ],
  states: [ duck.State, [
    'Idle',
    'Recognizing',
    'Understanding',
    'Responding',
  ] ],
  initialContext: {} as Context,
})

export default duckula
