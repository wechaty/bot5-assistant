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

export interface Context {
  chairs   : { [id: string]: PUPPET.payloads.Contact }
  room?    : PUPPET.payloads.Room
  contacts : { [id: string]: PUPPET.payloads.Contact }
  gerror?   : string
  feedbacks: { [id: string]: string }
  actors: {
    notice : string
    register : string
    wechaty  : string
  }
}

const duckula = Mailbox.duckularize({
  id: 'Brainstorming',
  events: [ { ...duck.Event }, [
    /**
     * Config
     */
    'CONTACTS',
    /**
     * Requests
     */
    'REPORT',
    /**
     * Responses
     */
    'GERROR',
    'FEEDBACKS',
    /**
     * Internal
     */
    'ADMINS',
    'COMPLETE',
    'CONTACTS',
    'FEEDBACK',
    'IDLE',
    'INTRODUCE',
    'MESSAGE',
    'NEXT',
    'NO_CONTACT',
    'NOTICE',
    'REPORT',
    'RESET',
    'ROOM',
  ] ],
  states: [ duck.State, [
    /**
     * Request
     */
    'Idle',
    /**
     * Response
     */
    'Responding',
    'Responded',
    'Erroring',
    'Errored',
    /**
     * Internal
     */
    'Resetting',
    'Reporting',
    'Initializing',
    'Completing',
    'Completed',
    'Nexting',
    /**
     * Interact with Actors
     */
    'Registering',
    'Registered',
    'Feedbacking',
    'Feedbacked',
  ] ],
  initialContext: ({
    chairs    : {},
    room      : undefined,
    contacts : {},
    gerror: undefined,
    feedbacks: {},
  }) as Context,
})

export type Event = ReturnType<typeof duckula.Event[keyof typeof duckula.Event]>
export type Events = {
  [key in keyof typeof duckula.Event]: ReturnType<typeof duckula.Event[key]>
}

export default duckula
