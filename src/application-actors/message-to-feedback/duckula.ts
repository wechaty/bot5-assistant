/* eslint-disable sort-keys */
import * as Mailbox   from 'mailbox'
import * as CQRS      from 'wechaty-cqrs'

import * as duck    from '../../duck/mod.js'

export interface Context {
  talkerId?: string,
  address: {
    wechaty: string,
  }
}

const duckula = Mailbox.duckularize({
  id: 'MessageToFeedback',
  events: [ { ...duck.Event, ...CQRS.duck.actions, ...Mailbox.Event }, [
    /**
     * Request
     */
    'MESSAGE',
    /**
     * Response
     */
    'FEEDBACK',
    'GERROR',
    /**
     * Internal
     */
    'TEXT',
    'FILE_BOX',
    'LOAD',
    // CQRS
    'GET_MESSAGE_FILE_QUERY_RESPONSE',
    // Mailbox
    'ACTOR_REPLY',
  ] ],
  states: [ duck.State, [
    'Erroring',
    'Feedbacking',
    'Idle',
    'Loading',
    'Textualizing',
    'Responding',
  ] ],
  initialContext: {} as Context,
})

export type Event = ReturnType<typeof duckula.Event[keyof typeof duckula.Event]>
export type Events = {
  [key in keyof typeof duckula.Event]: ReturnType<typeof duckula.Event[key]>
}

export default duckula
