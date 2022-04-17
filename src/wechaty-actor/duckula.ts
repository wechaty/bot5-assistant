/* eslint-disable sort-keys */
import type * as CQRS    from 'wechaty-cqrs'

import { duckularize }    from '../duckula/duckularize.js'

import * as duck    from './duck/mod.js'

export interface Context {
  bus$      : CQRS.Bus
  puppetId? : string
}

const duckula = duckularize({
  id: 'WechatyActor',
  events: duck.Event,
  states: duck.State,
  initialContext: {} as Context,
})

export default duckula
