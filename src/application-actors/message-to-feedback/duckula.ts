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
import * as Mailbox   from 'mailbox'
import * as CQRS      from 'wechaty-cqrs'

import * as duck    from '../../duck/mod.js'

export interface Context {
  talkerId?: string,
  address: {
    wechaty: string,
  }
}

const duckula = Mailbox.duckularize({
  id: 'MessageToFeedback',
  events: [ { ...duck.Event, ...CQRS.duck.actions, ...Mailbox.Event }, [
    /**
     * Request
     */
    'MESSAGE',
    /**
     * Response
     */
    'FEEDBACK',
    'GERROR',
    /**
     * Internal
     */
    'TEXT',
    'FILE_BOX',
    'LOAD',
    // CQRS
    'GET_MESSAGE_FILE_QUERY_RESPONSE',
    // Mailbox
    'ACTOR_REPLY',
  ] ],
  states: [ duck.State, [
    'Erroring',
    'Feedbacking',
    'Idle',
    'Loading',
    'Textualizing',
    'Responding',
  ] ],
  initialContext: {} as Context,
})

export type Event = ReturnType<typeof duckula.Event[keyof typeof duckula.Event]>
export type Events = {
  [key in keyof typeof duckula.Event]: ReturnType<typeof duckula.Event[key]>
}

export default duckula
