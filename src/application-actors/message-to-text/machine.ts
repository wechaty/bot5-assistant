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

import { FileToText }         from '../../infrastructure-actors/mod.js'
import { responseStates }     from '../../actor-utils/response-states.js'

import * as MessageToFile   from '../message-to-file/mod.js'

import duckula, { Context, Event, Events }  from './duckula.js'

const machine = createMachine<
  Context,
  Event
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
     * Idle
     *
     *  1. receive MESSAGE -> transition to Filing
     */
    [duckula.State.Idle]: {
      entry: [
        Mailbox.actions.idle(duckula.id),
        actions.assign({ message: undefined }),
      ],
      on: {
        [duckula.Type.MESSAGE]: {
          target: duckula.State.Messaging,
          actions: actions.assign({ message: (_, e) => e.payload.message }),
        },
      },
    },

    /**
     * Messaging
     *
     * 1. receive MESSAGE with MessageType.Text -> emit TEXT
     * 2. receive MESSAGE with MessageType.* -> emit MESSAGE
     *
     * 3. receive TEXT    -> transition to Textualized
     * 4. receive MESSAGE -> transition to Filing
     */
    [duckula.State.Messaging]: {
      entry: [
        actions.log<Context, Events['MESSAGE']>(
          (_, e) => `states.Messaging.entry MessageType: ${PUPPET.types.Message[e.payload.message.type]}`,
          duckula.id,
        ),
        actions.choose<Context, Events['MESSAGE']>([
          {
            cond: (_, e) => e.payload.message.type === PUPPET.types.Message.Text,
            actions: [
              actions.send(
                (_, e) => e.payload.message.text
                  ? duckula.Event.TEXT(e.payload.message.text)
                  : duckula.Event.NO_TEXT()
                ,
              ),
            ],
          },
          {
            actions: actions.send((_, e) => e),
          },
        ]),
      ],
      on: {
        [duckula.Type.MESSAGE] : duckula.State.Filing,
        [duckula.Type.NO_TEXT] : duckula.State.Textualized,
        [duckula.Type.TEXT]    : duckula.State.Textualized,
      },
    },

    /**
     * Filing: invoke MessageToFile actor
     *
     * 1. received MESSAGE    -> emit FILE / NO_FILE / GERROR
     *
     * 2. received FILE     -> transition to Recognizing
     * 3. received NO_FILE  -> emit NO_TEXT
     * 4. received GERROR   -> transition to Erroring
     */
    [duckula.State.Filing]: {
      invoke: {
        id: MessageToFile.id,
        src: ctx => Mailbox.wrap(
          MessageToFile.machine.withContext({
            ...MessageToFile.initialContext(),
            actors: { wechaty: ctx.actors.wechaty },
          }),
        ),
        onDone:  { actions: actions.send((_, e) => duckula.Event.GERROR(GError.stringify(e.data))) },
        onError: { actions: actions.send((_, e) => duckula.Event.GERROR(GError.stringify(e.data))) },
      },
      entry: [
        actions.log('states.Filing.entry', duckula.id),
        actions.send((_, e) => e, { to: MessageToFile.id }),
      ],
      on: {
        '*': {
          actions: actions.log((_, e) => `states.Filing.on ${JSON.stringify(e)}`, duckula.id),
        },
        [duckula.Type.NO_FILE]: {
          actions: actions.send(duckula.Event.NO_TEXT()),
        },
        [duckula.Type.FILE]    : duckula.State.Recognizing,
        [duckula.Type.GERROR]  : duckula.State.Erroring,
        [duckula.Type.NO_TEXT] : duckula.State.Textualized,
      },
    },

    /**
     * Recognizing: invoke FileToText actor
     *
     *  1. received FILE     -> emit TEXT / NO_TEXT / GERROR
     */
    [duckula.State.Recognizing]: {
      invoke: {
        id:  FileToText.id,
        src: Mailbox.wrap(
          FileToText.machine.withContext(FileToText.initialContext()),
        ),
        onDone:  { actions: actions.send((_, e) => duckula.Event.GERROR(GError.stringify(e.data))) },
        onError: { actions: actions.send((_, e) => duckula.Event.GERROR(GError.stringify(e.data))) },
      },
      entry: [
        actions.log(
          (_, e) => [
            'states.Recognizing.entry fileBox: "',
            JSON.parse(
              (e as ReturnType<typeof duckula.Event['FILE']>)
                .payload
                .box,
            ).name,
            '"',
          ].join(''),
          duckula.id,
        ),
        actions.send((_, e) => e, { to: FileToText.id }),
      ],
      on: {
        [duckula.Type.TEXT]    : duckula.State.Textualized,
        [duckula.Type.NO_TEXT] : duckula.State.Textualized,
        [duckula.Type.GERROR]  : {
          actions: [
            actions.log((_, e) => `state.Recognizing.on GERROR ${e.payload.gerror}`, duckula.id),
            actions.send(duckula.Event.NO_TEXT()),
          ],
        },
      },
    },

    [duckula.State.Textualized]: {
      entry: [
        actions.send<Context, Events['TEXT'] | Events['NO_TEXT']>(
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
        [duckula.Type.TEXT]    : duckula.State.Responding,
        [duckula.Type.NO_TEXT] : duckula.State.Responding,
      },
    },

    ...responseStates(duckula.id),
  },
})

export default machine
