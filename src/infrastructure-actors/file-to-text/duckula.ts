/* eslint-disable sort-keys */
import * as Mailbox   from 'mailbox'

import * as duck            from '../../duck/mod.js'

export interface Context {}

const duckula = Mailbox.duckularize({
  id:  'FileToText',
  events: [ duck.Event, [
    /**
     * Request
     */
    'FILE_BOX',
    /**
     * Response
     */
    'TEXT',
    'GERROR',
    /**
     * Internal
     */
  ] ],
  states: [ duck.State, [
    'Idle',
    'Recognizing',
    'Erroring',
    'Responding',
  ] ],
  initialContext: ({}),
})

export default duckula
