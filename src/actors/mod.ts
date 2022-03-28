import type { ActionCreator } from 'typesafe-actions'

import type * as Mailbox  from '../mailbox/mod.js'
import * as wechaty       from '../wechaty-actor/mod.js'

import * as assistant     from './assistant-actor.js'
import * as feedback      from './feedback-actor.js'
import * as intent        from './intent-actor.js'
import * as meeting       from './meeting-actor.js'
import * as register      from './register-actor.js'
import * as brainstorming from './brainstorming-actor.js'
import * as notice        from './notice-actor.js'

interface ActorModel {
  mailboxFactory: (...args: any[]) => Mailbox.Interface
  // machineFactory: (...args: any[]) => StateMachine<any, any, any>
  Events: {
    [key: string]: ActionCreator,
  }
}

const actors: {
  [key: string]: ActorModel,
} = {
  assistant,
  brainstorming,
  feedback,
  intent,
  meeting,
  notice,
  register,
  wechaty,
}
void actors // for typing testing only

export {
  assistant,
  brainstorming,
  feedback,
  intent,
  meeting,
  register,
  wechaty,
  notice,
}
