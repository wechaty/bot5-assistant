/* eslint-disable sort-keys */
import * as Mailbox   from 'mailbox'
import * as CQRS      from 'wechaty-cqrs'

import * as duck    from '../../duck/mod.js'

export interface Context {
  talkerId?: string,
  address?: {
    wechaty: string,
  }
}

const duckula = Mailbox.duckularize({
  id: 'MessageToFeedback',
  events: [ { ...duck.Event, ...CQRS.duck.actions }, [
    // request
    'MESSAGE',
    // response
    'FEEDBACK',
    // internal
    'TEXT',
    'GERROR',
    'FILE_BOX',
    'LOAD',
    'GET_MESSAGE_FILE_QUERY_RESPONSE',
  ] ],
  states: [ duck.State, [
    'Classifying',
    'Erroring',
    'Feedbacking',
    'Idle',
    'Loading',
    'Texting',
    'Recognizing',
  ] ],
  initialContext: {} as Context,
})

export default duckula
