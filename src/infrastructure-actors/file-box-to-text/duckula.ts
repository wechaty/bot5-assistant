/* eslint-disable sort-keys */
import * as Mailbox   from 'mailbox'

import * as duck            from '../../duck/mod.js'

export interface Context {}

const duckula = Mailbox.duckularize({
  id:  'FileBoxToText',
  events: [ duck.Event, [
    /**
     * Request
     */
    'FILE_BOX',
    /**
     * Response
     */
    'TEXT',
    /**
     * Internal
     */
    'GERROR',
  ] ],
  states: [ duck.State, [
    'Idle',
    'Recognizing',
    'Erroring',
    'Responding',
    'Texting',
  ] ],
  initialContext: ({}),
})

export default duckula
