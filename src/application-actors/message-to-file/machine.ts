/* eslint-disable sort-keys */
import { createMachine, actions }   from 'xstate'
import * as Mailbox                 from 'mailbox'
import { FileBox }                  from 'file-box'
import * as PUPPET                  from 'wechaty-puppet'
import * as CQRS                    from 'wechaty-cqrs'

import duckula                from './duckula.js'
import { fileMessageTypes }   from './file-message-types.js'

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
     *  1. receive MESSAGE -> transition to Classifying
     *
     */
    [duckula.State.Idle]: {
      entry: [
        Mailbox.actions.idle(duckula.id)('idle'),
      ],
      on: {
        [duckula.Type.MESSAGE]: {
          actions: [
            actions.log('state.Idle.on.MESSAGE', duckula.id),
          ],
          target: duckula.State.Classifying,
        },
      },
    },

    /**
     * Classifying
     *
     *  1. received MESSAGE -> TEXT / LOAD
     */

    [duckula.State.Classifying]: {
      entry: [
        actions.log('state.Classifying.entry', duckula.id),
        actions.choose<ReturnType<typeof duckula.initialContext>, ReturnType<typeof duckula.Event['MESSAGE']>>([
          {
            cond: (_, e) => fileMessageTypes.includes(e.payload.message.type),
            actions: actions.send((_, e) => duckula.Event.LOAD(e.payload.message.id)),
          },
          {
            actions: actions.send((_, e) => duckula.Event.GERROR(`Message type "${PUPPET.types.Message[e.payload.message.type]}" is not supported by the messageToFileBox actor`)),
          },
        ]),
      ],
      on: {
        [duckula.Type.LOAD]   : duckula.State.Loading,
        [duckula.Type.GERROR] : duckula.State.Erroring,
      },
    },

    /**
     * Load
     *
     *  1. received LOAD                            -> emit GET_MESSAGE_FILE_QUERY_RESPONSE
     *  2. received GET_MESSAGE_FILE_QUERY_RESPONSE -> emit FILE_BOX / GERROR
     *
     *  3. received FILE_BOX -> transition to Responding
     *  4. received GERROR   -> transition to Erroring
     */
    [duckula.State.Loading]: {
      entry: [
        actions.log('state.Loading.entry', duckula.id),
        actions.send(
          (_, e) => CQRS.queries.GetMessageFileQuery(
            CQRS.uuid.NIL,
            (e as ReturnType<typeof duckula.Event['LOAD']>).payload.id,
          ),
          { to: ctx => ctx.address!.wechaty },
        ),
      ],
      on: {
        [duckula.Type.GET_MESSAGE_FILE_QUERY_RESPONSE]: {
          actions: [
            actions.send((_, e) => duckula.Event.FILE_BOX(FileBox.fromJSON(e.payload.file!))),
          ],
        },
        [duckula.Type.FILE_BOX] : duckula.State.Responding,
        [duckula.Type.GERROR]   : duckula.State.Erroring,
      },
    },

    [duckula.State.Responding]: {
      entry: [
        actions.log('state.Responding.entry', duckula.id),
        Mailbox.actions.reply((_, e) => e),
      ],
      always: duckula.State.Idle,
    },

    [duckula.State.Erroring]: {
      entry: [
        actions.log('state.Erroring.entry', duckula.id),
        Mailbox.actions.reply((_, e) => e),
      ],
      always: duckula.State.Idle,
    },

  },
})

export default machine
