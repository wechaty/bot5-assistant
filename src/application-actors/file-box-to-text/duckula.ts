/* eslint-disable sort-keys */
import * as Mailbox   from 'mailbox'

import * as duck            from '../../duck/mod.js'

export interface Context {}

const duckula = Mailbox.duckularize({
  id:  'FileBoxToText',
  events: [ duck.Event, [
    /**
     * @request
     */
    'FILE_BOX',
    /**
     * @response
     */
    'TEXT',
    'GERROR',
  ] ],
  states: [ duck.State, [
    'Idle',
    'Recognizing',
    'Responding',
  ] ],
  initialContext: ({}),
})

export default duckula
