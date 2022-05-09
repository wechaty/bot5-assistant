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
import * as CQRS                    from 'wechaty-cqrs'
import * as WechatyActor            from 'wechaty-actor'

import { responseStates }     from '../../pure/mod.js'

import duckula, { Context, Event, Events }    from './duckula.js'

const machine = createMachine<
  Context,
  Event | WechatyActor.Events[keyof WechatyActor.Events] | ReturnType<typeof CQRS.duck.actions.GET_ROOM_PAYLOAD_QUERY_RESPONSE>
>({
  id: duckula.id,
  context: duckula.initialContext,

  initial: duckula.State.Initializing,
  states: {
    [duckula.State.Initializing]: {
      entry: [
        actions.log(ctx => `states.Initializing.entry context ${JSON.stringify(ctx)}`, duckula.id),
      ],
      always: duckula.State.Idle,
    },

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
        actions.assign({ message: undefined }),
      ],
      on: {
        [duckula.Type.MESSAGE]: {
          target: duckula.State.Loading,
          actions: actions.assign({ message: (_, e) => e.payload.message }),
        },
      },
    },

    /**
     * Loading:
     *
     *  1. received MESSAGE                                             -> emit BATCH(GET_CONTACT_PAYLOAD_QUERY) / GERROR / CONTACTS
     *  2. received BATCH_RESPONSE(GET_CONTACT_PAYLOAD_QUERY_RESPONSE)  -> emit CONTACTS
     *
     *  3. received CONTACTS -> transition to Responding
     *  4. received GERROR   -> transition to Errored
     */

    [duckula.State.Loading]: {
      entry: [
        actions.choose<Context, Events['MESSAGE']>([
          {
            cond: (_, e) => !!e.payload.message.roomId,
            actions: actions.send(
              (_, e) => CQRS.duck.actions.GET_ROOM_PAYLOAD_QUERY(
                CQRS.uuid.NIL,
                e.payload.message.roomId!,
              ),
              { to: ctx => ctx.actors.wechaty },
            ),
          },
          {
            actions: actions.send(duckula.Event.NO_ROOM()),
          },
        ]),
      ],
      on: {
        [CQRS.duck.types.GET_ROOM_PAYLOAD_QUERY_RESPONSE] : {
          actions: actions.send(
            (_, e) => e.payload.room
              ? duckula.Event.ROOM(e.payload.room)
              : duckula.Event.NO_ROOM())
          ,
        },
        [WechatyActor.Type.GERROR] : {
          actions: (_, e) => actions.send(duckula.Event.GERROR(e.payload.gerror)),
        },
        [duckula.Type.ROOM]    : duckula.State.Loaded,
        [duckula.Type.NO_ROOM] : duckula.State.Loaded,
        [duckula.Type.GERROR]  : duckula.State.Erroring,
      },
    },

    [duckula.State.Loaded]: {
      entry: [
        actions.send<Context, Events['ROOM'] | Events['NO_ROOM']>(
          (ctx, e) => ({
            ...e,
            payload: {
              ...e.payload,
              message: ctx.message,
            },
          }),
        ),
      ],
      on: {
        [duckula.Type.ROOM]    : duckula.State.Responding,
        [duckula.Type.NO_ROOM] : duckula.State.Responding,
      },
    },

    ...responseStates(duckula.id),
  },
})

export default machine
