/* eslint-disable sort-keys */
import type * as PUPPET     from 'wechaty-puppet'
import * as Mailbox         from 'mailbox'

import * as WechatyActor    from '../../wechaty-actor/mod.js'
import * as duck            from '../../duck/mod.js'

export interface Context {
  message?: PUPPET.payloads.MessageRoom
  contacts: { [id: string]: PUPPET.payloads.Contact },
  chairs:   { [id: string]: PUPPET.payloads.Contact },
  gerror?:  string
  address: {
    wechaty: string,
    noticing: string,
  },
}

const duckula = Mailbox.duckularize({
  id: 'Register',
  events: [ { ...duck.Event, ...WechatyActor.Event }, [
    /**
     * Request
     */
    'MESSAGE',
    'REPORT',
    'RESET',
    /**
     * Response
     */
    'CONTACTS',
    /**
     * Internal
     */
    'GERROR',
    'IDLE',
    'INTRODUCE',
    'MENTION',
    'NEXT',
    'BATCH_RESPONSE',
    'BATCH_EXECUTE',
  ] ],
  states: [ duck.State, [
    'Confirming',
    'Erroring',
    'Idle',
    'Initializing',
    'Mentioning',
    'Parsing',
    'Reporting',
    'Resetting',
    'Introducing',
    'Responding',
  ] ],
  initialContext: {
    message  : undefined,
    contacts : {},
    chairs   : {},
    gerror   : undefined,
  } as Context,
})

export type Event = ReturnType<typeof duckula.Event[keyof typeof duckula.Event]>
export type Events = {
  [key in keyof typeof duckula.Event]: ReturnType<typeof duckula.Event[key]>
}

export default duckula
