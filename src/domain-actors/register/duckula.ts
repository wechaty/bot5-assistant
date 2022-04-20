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
  address?: {
    wechaty: string,
  },
}

const duckula = Mailbox.duckularize({
  id: 'RegisterActor',
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
    address : undefined,
  } as Context,
})

export default duckula
