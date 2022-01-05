import type { ActionCreator } from 'typesafe-actions'

import type * as Mailbox from '../mailbox/mod.js'

import * as feedback  from './feedback-actor.js'
import * as intent    from './intent-actor.js'
import * as register  from './register-actor.js'
import * as wechaty   from './wechaty-actor.js'

interface ActorModel {
  mailboxFactory: (...args: any[]) => Mailbox.Mailbox
  // machineFactory: (...args: any[]) => StateMachine<any, any, any>
  Events: {
    [key: string]: ActionCreator,
  }
}

const actors: {
  [key: string]: ActorModel,
} = {
  feedback,
  intent,
  register,
  wechaty,
}
void actors // for typing testing only

export {
  feedback,
  intent,
  register,
  wechaty,
}
