/* eslint-disable sort-keys */
import type * as PUPPET   from 'wechaty-puppet'
import * as CQRS          from 'wechaty-cqrs'
import * as Mailbox       from 'mailbox'

import * as duck            from '../../duck/mod.js'

import * as NoticingDuckula from '../noticing/mod.js'

export interface Context {
  minutes?    : string
  room?       : PUPPET.payloads.Room
  chairs      : PUPPET.payloads.Contact[]
  attendees   : { [id: string]: PUPPET.payloads.Contact }
  brainstorms : { [key: string]: string }
  address: {
    noticing      : string,
    register      : string,
    feedback      : string,
    brainstorming : string,
    intent        : string,
  }
}

const duckula = Mailbox.duckularize({
  id: 'Meeting',
  events: [ { ...duck.Event, ...CQRS.duck.actions, ...Mailbox.Event, ...NoticingDuckula.Event }, [
    /**
     * Config
     */
    /**
     * Requests
     */
    /**
     * Responses
     */
    /**
     * Internal
     */
    'MINUTE',
    'IDLE',
    'RESET',
    'REPORT',
    'ROOM',
    'ATTENDEES',
    'CHAIRS',
    'PROCESS',
    'MESSAGE',
    'FEEDBACKS',
    'BACK',
    'NEXT',
    'INTENTS',
    'CONTACTS',
    /**
     * NoticingDuckula
     */
    'NOTICE',
  ] ],
  states: [ duck.State, [
    'Initializing',
    'Idle',
    'Mentioning',
    'Upgrading',
    'Brainstorming',
    'Resetting',
    'Registering',
    'Electing',
    'Elected',
    'Reporting',
    'Processing',
    'Announcing',
    'Presenting',
    'Introducing',
    'Summarizing',
    'Pledging',
    'Photoing',
    'Housekeeping',
    'Chatting',
    'Retrospecting',
    'Joining',
    'Roasting',
    'Summarized',
    'Finishing',
    'Drinking',
  ] ],
  initialContext: ({
    minutes    : undefined,
    room       : undefined,
    attendees   : {},
    chairs      : {},
    brainstorms : {},
  }) as Context,
})

export type Event = ReturnType<typeof duckula.Event[keyof typeof duckula.Event]>
export type Events = {
  [key in keyof typeof duckula.Event]: ReturnType<typeof duckula.Event[key]>
}

export default duckula
