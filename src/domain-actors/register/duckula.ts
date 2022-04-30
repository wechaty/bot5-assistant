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
import type * as PUPPET     from 'wechaty-puppet'
import * as Mailbox         from 'mailbox'

import * as WechatyActor    from '../../wechaty-actor/mod.js'
import * as duck            from '../../duck/mod.js'

export interface Context {
  /**
   * Required
   */
  actors: {
    wechaty: string
  }
  chairs: {
    [id: string]: PUPPET.payloads.Contact
  }
  /**
   * To-be-filled
   */
  message?: PUPPET.payloads.MessageRoom & PUPPET.payloads.MessageBase
  contacts: { [id: string]: PUPPET.payloads.Contact }
}

const duckula = Mailbox.duckularize({
  id: 'Register',
  events: [ { ...duck.Event, ...WechatyActor.Event }, [
    /**
     * Request
     */
    'REPORT',
    'MESSAGE',
    /**
     * Response
     */
    'CONTACTS',
    'GERROR',
    /**
     * Config
     */
    'RESET',
    /**
     * Internal
     */
    'INTRODUCE',
    'NEXT',
    'NOTICE',
    // WechatyActor
    'BATCH_RESPONSE',
  ] ],
  states: [ duck.State, [
    'Confirming',
    'Erroring',
    'Errored',
    'Idle',
    'Initializing',
    'Introducing',
    'Loading',
    'Mentioning',
    'Reporting',
    'Resetting',
    'Responding',
    'Responded',
  ] ],
  initialContext: {
    message  : undefined,
    contacts : {},
  },
})

export type Event = ReturnType<typeof duckula.Event[keyof typeof duckula.Event]>
export type Events = {
  [key in keyof typeof duckula.Event]: ReturnType<typeof duckula.Event[key]>
}

export default duckula
