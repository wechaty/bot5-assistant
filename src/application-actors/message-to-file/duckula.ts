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
  id: 'MessageToFile',
  events: [ { ...duck.Event, ...CQRS.duck.actions }, [
    /**
     * Request
     */
    'MESSAGE',
    /**
     * Response
     */
    'FILE_BOX',
    'GERROR',
    /**
     * Internal
     */
    'LOAD',
    'GET_MESSAGE_FILE_QUERY_RESPONSE',
  ] ],
  states: [ duck.State, [
    'Erroring',
    'Idle',
    'Loading',
    'Classifying',
    'Responding',
  ] ],
  initialContext: {} as Context,
})

export default duckula
