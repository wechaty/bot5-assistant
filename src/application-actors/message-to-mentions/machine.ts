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
import { createMachine, actions }   from 'xstate'
import * as Mailbox                 from 'mailbox'
import type * as PUPPET             from 'wechaty-puppet'
import * as CQRS                    from 'wechaty-cqrs'

import * as ACTOR                   from '../../wechaty-actor/mod.js'

import duckula    from './duckula.js'
import { removeUndefined } from '../../pure-functions/remove-undefined.js'

const machine = createMachine<
  ReturnType<typeof duckula.initialContext>,
  ReturnType<typeof duckula.Event[keyof typeof duckula.Event]>
>({
  id: duckula.id,
  initial: duckula.State.Idle,
  context: duckula.initialContext,
  states: {

    /**
     *
     * Idle
     *
     *  1. receive MESSAGE -> transition to Loading
     *
     */
    [duckula.State.Idle]: {
      entry: [
        Mailbox.actions.idle(duckula.id),
      ],
      on: {
        [duckula.Type.MESSAGE]: {
          target: duckula.State.Loading,
        },
      },
    },

    /**
     * Loading:
     *
     *  1. received MESSAGE                                             -> emit BATCH_EXECUTE(GET_CONTACT_PAYLOAD_QUERY) / GERROR / CONTACTS
     *  2. received BATCH_RESPONSE(GET_CONTACT_PAYLOAD_QUERY_RESPONSE)  -> emit CONTACTS
     *
     *  3. received CONTACTS -> transition to Responding
     *  4. received GERROR   -> transition to Erroring
     */

    [duckula.State.Loading]: {
      entry: [
        actions.choose<ReturnType<typeof duckula.initialContext>, ReturnType<typeof duckula.Event['MESSAGE']>>([
          {
            cond: (_, e) => ((e.payload.message as PUPPET.payloads.MessageRoom).mentionIdList ?? []).length > 0,
            actions: actions.send(
              (_, e) => ACTOR.Event.BATCH_EXECUTE(
                (
                  (e.payload.message as PUPPET.payloads.MessageRoom)
                    .mentionIdList ?? []
                ).map(contactId => CQRS.duck.actions.GET_CONTACT_PAYLOAD_QUERY(
                  CQRS.uuid.NIL,
                  contactId,
                )),
              ),
              { to: ctx => ctx.actors!.wechaty },
            ),
          },
          {
            actions: actions.send(duckula.Event.CONTACTS([])),
          },
        ]),
      ],
      on: {
        [ACTOR.Type.GERROR]         : duckula.State.Erroring,
        [duckula.Type.CONTACTS]     : duckula.State.Responding,
        [ACTOR.Type.BATCH_RESPONSE] : {
          actions: [
            actions.send((_, e) => duckula.Event.CONTACTS(
              e.payload.responseList
                .map(response =>
                  (response as ReturnType<typeof CQRS.duck.actions.GET_CONTACT_PAYLOAD_QUERY_RESPONSE>)
                    .payload
                    .contact,
                )
                .filter(removeUndefined),
            )),
          ],
        },
      },
    },

    [duckula.State.Responding]: {
      entry: [
        Mailbox.actions.reply((_, e) => e),
      ],
      always: duckula.State.Idle,
    },

    [duckula.State.Erroring]: {
      entry: [
        Mailbox.actions.reply((_, e) => e),
      ],
      always: duckula.State.Idle,
    },

  },
})

export default machine
