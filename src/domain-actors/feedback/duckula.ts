/* eslint-disable sort-keys */
import type * as PUPPET   from 'wechaty-puppet'
import * as CQRS          from 'wechaty-cqrs'
import * as Mailbox       from 'mailbox'

import * as duck            from '../../duck/mod.js'

export interface Context {
  admins    : { [id: string]: PUPPET.payloads.Contact }
  contacts  : { [id: string]: PUPPET.payloads.Contact }
  feedbacks : { [id: string]: string }
  message?: PUPPET.payloads.Message
  address: {
    noticing: string,
    registering: string,
    wechaty: string,
  },
}

const duckula = Mailbox.duckularize({
  id: 'Feedback',
  events: [ { ...duck.Event, ...CQRS.duck.actions, ...Mailbox.Event }, [
    /**
     * Config
     */
    'ADMINS',
    'CONTACTS',
    'RESET',
    /**
     * Requests
     */
    'MESSAGE',
    'REPORT',
    /**
     * Responses
     */
    'FEEDBACKS',
    /**
     * Internal
     */
    'FEEDBACK',
    'TEXT',
    'NO_CONTACT',
    'GERROR',
    'IDLE',
    'PROCESS',
    'NEXT',
    // Mailbox
    'ACTOR_REPLY',
  ] ],
  states: [ duck.State, [
    'Feedbacking',
    'Idle',
    'Initializing',
    'Textualizing',
    'Processing',
    'Registering',
    'Reporting',
    'Erroring',
    'Nexting',
    'Responding',
  ] ],
  initialContext: ({
    contacts: {},
    feedbacks: {},
    message: undefined,
  }) as Context,
})

export type Event = ReturnType<typeof duckula.Event[keyof typeof duckula.Event]>
export type Events = {
  [key in keyof typeof duckula.Event]: ReturnType<typeof duckula.Event[key]>
}

export default duckula
