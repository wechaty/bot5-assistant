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
import { GError }                   from 'gerror'
import * as PUPPET                  from 'wechaty-puppet'

import * as fileToTextActor    from '../../infrastructure-actors/file-to-text/mod.js'

import * as messageToFileActor    from '../message-to-file/mod.js'

import duckula, { Context, Event, Events }  from './duckula.js'

const machine = createMachine<
  Context,
  Event
>({
  id: duckula.id,
  initial: duckula.State.Idle,
  context: duckula.initialContext,
  states: {

    /**
     *
     * Idle
     *
     *  1. receive MESSAGE -> transition to Filing
     *
     */
    [duckula.State.Idle]: {
      entry: [
        Mailbox.actions.idle(duckula.id),
        actions.assign({ message: undefined }),
      ],
      on: {
        [duckula.Type.MESSAGE]: {
          target: duckula.State.Classifying,
          actions: actions.assign({ message: (_, e) => e.payload.message }),
        },
      },
    },

    /**
     * Classifying
     *
     * 1. receive MESSAGE with MessageType.Text -> emit TEXT
     * 2. receive MESSAGE with MessageType.* -> emit MESSAGE
     *
     * 3. receive TEXT    -> transition to Responding
     * 4. receive MESSAGE -> transition to Filing
     */
    [duckula.State.Classifying]: {
      entry: [
        actions.log<Context, Events['MESSAGE']>(
          (_, e) => `state.Classifying.entry MessageType: ${PUPPET.types.Message[e.payload.message.type]}`,
          duckula.id,
        ),
        actions.choose<Context, Events['MESSAGE']>([
          {
            cond: (_, e) => e.payload.message.type === PUPPET.types.Message.Text,
            actions: [
              actions.send((_, e) => duckula.Event.TEXT(e.payload.message.text || '')),
            ],
          },
          {
            actions: actions.send((_, e) => e),
          },
        ]),
      ],
      on: {
        [duckula.Type.TEXT]: duckula.State.Responding,
        [duckula.Type.MESSAGE]: duckula.State.Filing,
      },
    },

    /**
     * Filing: invoke messageToFileActor
     *
     * 1. received MESSAGE    -> emit ACTOR_REPLY
     * 2. receive ACTOR_REPLY -> emit unwrapped event FILE_BOX / GERROR
     *
     * 3. received FILE_BOX -> transition to Recognizing
     * 4. received GERROR   -> transition to Erroring
     */
    [duckula.State.Filing]: {
      invoke: {
        id: messageToFileActor.id,
        src: ctx => messageToFileActor.machine.withContext({
          ...messageToFileActor.initialContext(),
          actors: ctx.actors,
        }),
        onDone: { actions: actions.send((_, e) => duckula.Event.GERROR(GError.stringify(e.data))) },
        onError: { actions: actions.send((_, e) => duckula.Event.GERROR(GError.stringify(e.data))) },
      },
      entry: [
        actions.log((_, e) => `state.Filing.entry ${JSON.stringify(e)}`, duckula.id),
        actions.send((_, e) => e, { to: messageToFileActor.id }),
      ],
      on: {
        [duckula.Type.ACTOR_REPLY]: {
          actions: [
            actions.log((_, e) => `state.Filing.on.ACTOR_REPLY [${e.payload.message.type}]`, duckula.id),
            actions.send((_, e) => e.payload.message),
          ],
        },
        [duckula.Type.FILE_BOX] : duckula.State.Recognizing,
        [duckula.Type.GERROR]   : duckula.State.Erroring,
      },
    },

    [duckula.State.Recognizing]: {
      invoke: {
        id: fileToTextActor.id,
        src: fileToTextActor.machine.withContext(fileToTextActor.initialContext()),
        onDone: { actions: actions.send((_, e) => duckula.Event.GERROR(GError.stringify(e.data))) },
        onError: { actions: actions.send((_, e) => duckula.Event.GERROR(GError.stringify(e.data))) },
      },
      entry: [
        actions.log(
          (_, e) => [
            'states.Recognizing.entry fileBox: "',
            (e as ReturnType<typeof duckula.Event['FILE_BOX']>)
              .payload
              .fileBox
              .name,
            '"',
          ].join(''),
          duckula.id,
        ),
        actions.send((_, e) => e, { to: fileToTextActor.id }),
      ],
      on: {
        [duckula.Type.ACTOR_REPLY]: {
          actions: [
            actions.log((_, e) => `state.Recognizing.on.ACTOR_REPLY [${e.payload.message.type}]`, duckula.id),
            actions.send((_, e) => e.payload.message),
          ],
        },
        [duckula.Type.TEXT]: duckula.State.Responding,
        [duckula.Type.GERROR]: duckula.State.Erroring,
      },
    },

    [duckula.State.Responding]: {
      entry: [
        Mailbox.actions.reply<Context, Events['TEXT']>((ctx, e) => duckula.Event.TEXT(
          e.payload.text,
          ctx.message,
        )),
      ],
      always: duckula.State.Idle,
    },

    [duckula.State.Erroring]: {
      entry: [
        actions.log((_, e) => `state.Erroring.entry [ERROR(${(e as ReturnType<typeof duckula.Event.GERROR>).payload.gerror})]`, duckula.id),
        Mailbox.actions.reply((_, e) => duckula.Event.TEXT(
          (e as ReturnType<typeof duckula.Event.GERROR>)
            .payload
            .gerror,
        )),
      ],
      always: duckula.State.Idle,
    },

  },
})

export default machine
