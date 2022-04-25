/* eslint-disable sort-keys */
import type * as PUPPET   from 'wechaty-puppet'
import * as Mailbox       from 'mailbox'

import * as duck    from '../../duck/mod.js'

export interface Context {
  chairs   : { [id: string]: PUPPET.payloads.Contact },
  room?    : PUPPET.payloads.Room,
  contacts : { [id: string]: PUPPET.payloads.Contact },
  gerror?   : string,
  feedbacks: { [id: string]: string },
  address: {
    feedback : string,
    noticing : string,
    register : string,
    wechaty  : string,
  }
}

const duckula = Mailbox.duckularize({
  id: 'Brainstorming',
  events: [ { ...duck.Event }, [
    /**
     * Config
     */
    'CONTACTS',
    /**
     * Requests
     */
    'REPORT',
    /**
     * Responses
     */
    'GERROR',
    'FEEDBACKS',
    /**
     * Internal
     */
    'ADMINS',
    'COMPLETE',
    'CONTACTS',
    'FEEDBACK',
    'IDLE',
    'INTRODUCE',
    'MESSAGE',
    'NEXT',
    'NO_CONTACT',
    'NOTICE',
    'REPORT',
    'RESET',
    'ROOM',
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
    'Resetting',
    'Reporting',
    'Initializing',
    'Completing',
    'Completed',
    'Nexting',
    /**
     * Interact with Actors
     */
    'Registering',
    'Registered',
    'Feedbacking',
    'Feedbacked',
  ] ],
  initialContext: ({
    chairs    : {},
    room      : undefined,
    contacts : {},
    gerror: undefined,
    feedbacks: {},
  }) as Context,
})

export type Event = ReturnType<typeof duckula.Event[keyof typeof duckula.Event]>
export type Events = {
  [key in keyof typeof duckula.Event]: ReturnType<typeof duckula.Event[key]>
}

export default duckula
