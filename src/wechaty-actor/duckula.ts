/* eslint-disable sort-keys */
import type * as CQRS   from 'wechaty-cqrs'
import * as Mailbox     from 'mailbox'

import * as duck    from './duck/mod.js'

export interface Context {
  bus$      : CQRS.Bus
  puppetId? : string
}

const duckula = Mailbox.duckularize({
  id: 'WechatyActor',
  events: [ duck.Event, [
    /**
     * Request
     */
    'EXECUTE',
    'BATCH_EXECUTE',
    /**
     * Response
     */
    'RESPONSE',
    'BATCH_RESPONSE',
    'GERROR',
    /**
     * Internal
     */
    'IDLE',
  ] ],
  states: [ duck.State, [
    'Idle',
    'Classifying',
    'Erroring',
    'Executing',
    'Responding',
    'Batching',
    'BatchResponding',
  ] ],
  initialContext: {} as Context,
})

export default duckula
