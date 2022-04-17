/* eslint-disable sort-keys */
import type * as CQRS            from 'wechaty-cqrs'

import * as duck            from '../duck/mod.js'
import { duckularize }      from '../duckula/duckularize.js'

export interface Context {
  bus$      : CQRS.Bus
  puppetId? : string
}

const duckula = duckularize({
  id: 'WechatyMachine',
  events: duck.Event,
  states: duck.State,
  initialContext: {} as Context,
})

export default duckula
