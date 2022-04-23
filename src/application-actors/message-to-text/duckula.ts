/* eslint-disable sort-keys */
import * as Mailbox   from 'mailbox'
import * as CQRS      from 'wechaty-cqrs'

import * as duck    from '../../duck/mod.js'

export interface Context {
  address: {
    wechaty: string,
  },
}

const duckula = Mailbox.duckularize({
  id: 'MessageToText',
  events: [ { ...duck.Event, ...CQRS.duck.actions, ...Mailbox.Event }, [
    /**
     * Request
     */
    'MESSAGE',
    /**
     * Response
     */
    'TEXT',
    'GERROR',
    /**
     * Internal
     */
    'FILE_BOX',
    'LOAD',
    // CQRS.duck.actions
    'GET_MESSAGE_FILE_QUERY_RESPONSE',
    // Mailbox.Event
    'ACTOR_REPLY',
  ] ],
  states: [ duck.State, [
    /**
     * Request
     */
    'Idle',
    /**
     * Response
     */
    'Responding',
    'Erroring',
    /**
     * Internal
     */
    'Filing',
    'Recognizing',
    'Classifying',
  ] ],
  initialContext: {} as Context,
})

export type Event = ReturnType<typeof duckula.Event[keyof typeof duckula.Event]>
export type Events = {
  [key in keyof typeof duckula.Event]: ReturnType<typeof duckula.Event[key]>
}

export default duckula
