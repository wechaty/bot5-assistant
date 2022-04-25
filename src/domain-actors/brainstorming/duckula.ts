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
    /**
     * Internal
     */
    'FEEDBACKS',
    'INTRODUCE',
    'ROOM',
    'MESSAGE',
    'RESET',
    'NOTICE',
    'IDLE',
    'PROCESS',
    'ADMINS',
    'CONTACTS',
    'RESET',
    'MESSAGE',
    'REPORT',
    'NEXT',
  ] ],
  states: [ duck.State, [
    'Idle',
    'Initializing',
    'Registering',
    'Registered',
    'Resetting',
    'Reporting',
    'Erroring',
    'Feedbacking',
    'Feedbacked',
    'Processing',
    'Nexting',
    'Responding',
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
