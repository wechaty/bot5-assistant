/* eslint-disable sort-keys */
import * as Mailbox   from 'mailbox'
import * as CQRS      from 'wechaty-cqrs'

import * as duck    from '../../duck/mod.js'

export interface Context {
  address: {
    wechaty: string,
  }
}

const duckula = Mailbox.duckularize({
  id: 'MessageToFeedback',
  events: [ { ...duck.Event, ...CQRS.duck.actions }, [
    // request
    'MESSAGE',
    // response
    'TEXT',
    'GERROR',
    // internal
    'FILE_BOX',
    'LOAD',
    'GET_MESSAGE_FILE_QUERY_RESPONSE',
  ] ],
  states: [ duck.State, [
    'Idle',
    'Recognizing',
    'Responding',
    'Classifying',
    'Loading',
  ] ],
  initialContext: {} as Context,
})

export default duckula
