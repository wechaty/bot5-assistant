/* eslint-disable sort-keys */
import type * as PUPPET             from 'wechaty-puppet'

import * as WechatyActor    from '../wechaty-actor/mod.js'
import * as duck            from '../duck/mod.js'
import { duckularize }      from '../duckula/duckularize.js'

export interface Context {
  message?: PUPPET.payloads.MessageRoom
  contacts: { [id: string]: PUPPET.payloads.Contact },
  chairs:   { [id: string]: PUPPET.payloads.Contact },
  gerror?:  string
  address?: {
    wechaty: string,
  },
}

const duckula = duckularize({
  id: 'RegisterMachine',
  events: [ { ...duck.Event, ...WechatyActor.Event }, [
    'CONTACTS',
    'GERROR',
    'IDLE',
    'INTRODUCE',
    'MENTION',
    'MESSAGE',
    'NEXT',
    'REPORT',
    'RESET',
    'BATCH_RESPONSE',
    'BATCH',
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
