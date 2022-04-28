/**
 *   Wechaty Open Source Software - https://github.com/wechaty
 *
 *   @copyright 2022 Huan LI (李卓桓) <https://github.com/huan>, and
 *                   Wechaty Contributors <https://github.com/wechaty>.
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 *
 */
/* eslint-disable sort-keys */
import type * as PUPPET   from 'wechaty-puppet'
import * as Mailbox       from 'mailbox'

import * as duck    from '../../duck/mod.js'

import * as NoticingActor   from '../noticing/mod.js'

export interface Context {
  minutes?    : string
  room?       : PUPPET.payloads.Room
  chairs      : PUPPET.payloads.Contact[]
  attendees   : { [id: string]: PUPPET.payloads.Contact }
  brainstorms : { [key: string]: string }
  actors: {
    noticing      : string,
    register      : string,
    feedback      : string,
    brainstorming : string,
    intent        : string,
  }
}

const duckula = Mailbox.duckularize({
  id: 'Meeting',
  events: [ { ...NoticingActor.Event, ...duck.Event }, [
    /**
     * Config
     */
    'ROOM',
    'CHAIRS',
    'ATTENDEES',
    'RESET',
    /**
     * Requests
     */
    'REPORT',
    /**
     * Responses
     */
    'MINUTES',
    'GERROR',
    /**
     * Internal
     */
    'BACK',
    'CONTACTS',
    'FEEDBACKS',
    'HELP',
    'INTENTS',
    'MESSAGE',
    'NEXT',
    'PROCESS',
    /**
     * NoticingActor
     */
    'NOTICE',
  ] ],
  states: [ duck.State, [
    /**
     * Config & Request
     */
    'Idle',
    /**
     * Response
     */
    'Responding',
    'Erroring',
    /**
     * Internal
     */
    'Initializing',
    'Checkining',
    'Mentioning',
    /**
     * Meeting steps
     */
    'Starting',
    'Upgrading',
    'Brainstorming',
    'Resetting',
    'Resetted',
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
    'ShootingChairs',
    'ShootingAll',
    'ShootingDrinkers',
    'Housekeeping',
    'Chatting',
    'Retrospecting',
    'Joining',
    'Roasting',
    'Summarized',
    'Drinking',
    'Paying',
    'Finishing',
    'Finished',
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
