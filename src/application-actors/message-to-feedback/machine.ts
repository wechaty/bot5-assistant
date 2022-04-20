/* eslint-disable sort-keys */
import { createMachine, actions }   from 'xstate'
import * as Mailbox                 from 'mailbox'
import { GError }                   from 'gerror'
import { FileBox }                  from 'file-box'
import * as PUPPET                  from 'wechaty-puppet'
import * as CQRS                    from 'wechaty-cqrs'
import { isActionOf }               from 'typesafe-actions'

import { speechToText }   from '../../to-text/mod.js'

import duckula from './duckula.js'

const machine = createMachine<
  ReturnType<typeof duckula.initialContext>,
  ReturnType<typeof duckula.Event[keyof typeof duckula.Event]>
>({
  id: duckula.id,
  initial: duckula.State.Idle,
  context: duckula.initialContext,
  states: {
    [duckula.State.Idle]: {
      entry: [
        Mailbox.actions.idle(duckula.id)('idle'),
      ],
      on: {
        [duckula.Type.MESSAGE]: duckula.State.Classifying,
      },
    },
    [duckula.State.Classifying]: {
      entry: [
        actions.choose([
          {
            cond: (_, e) => isActionOf(duckula.Event.MESSAGE, e) && e.payload.message.type === PUPPET.types.Message.Text,
            actions: actions.send((_, e) => duckula.Event.TEXT((e as ReturnType<typeof duckula.Event['MESSAGE']>).payload.message.text || '')),
          },
          {
            cond: (_, e) => isActionOf(duckula.Event.MESSAGE, e) && e.payload.message.type === PUPPET.types.Message.Audio,
            actions: actions.send((_, e) => duckula.Event.LOAD((e as ReturnType<typeof duckula.Event['MESSAGE']>).payload.message.id)),
          },
          {
            actions: actions.send(duckula.Event.TEXT('')),
          },
        ]),
      ],
      on: {
        [duckula.Type.TEXT] : duckula.State.Responding,
        [duckula.Type.LOAD] : duckula.State.Loading,
      },
    },
    [duckula.State.Loading]: {
      entry: [
        actions.send(
          (_, e) => CQRS.queries.GetMessageFileQuery(CQRS.uuid.NIL, (e as ReturnType<typeof duckula.Event['LOAD']>).payload.id),
          { to: ctx => ctx.address.wechaty },
        ),
      ],
      on: {
        [duckula.Type.GET_MESSAGE_FILE_QUERY_RESPONSE]: {
          actions: [
            actions.choose([
              {
                cond: (_, e) => !!e.payload.file,
                actions: actions.send((_, e) => duckula.Event.FILE_BOX(FileBox.fromJSON(e.payload.file!))),
              },
              {
                actions: actions.send(duckula.Event.GERROR('duckula.Event.LOAD: no file found')),
              },
            ]),
          ],
        },
        [duckula.Type.FILE_BOX] : duckula.State.Recognizing,
        [duckula.Type.GERROR]   : duckula.State.Responding,
      },
    },
    [duckula.State.Recognizing]: {
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
      ],
      invoke: {
        src: (_, e) => speechToText((e as ReturnType<typeof duckula.Event['FILE_BOX']>).payload.fileBox),
        onDone: {
          actions: [
            actions.log((_, e) => `states.Recognizing.invoke.onDone "${e.data}"`, duckula.id),
            actions.send((_, e) => duckula.Event.TEXT(e.data)),
          ],
        },
        onError: {
          actions: [
            actions.log((_, e) => `states.Recognizing.invoke.onError "${e.data}"`, duckula.id),
            actions.send((_, e) => duckula.Event.TEXT(GError.stringify(e.data))),
          ],
        },
      },
      on: {
        [duckula.Type.TEXT]: duckula.State.Responding,
        [duckula.Type.GERROR]: duckula.State.Responding,
      },
    },
    [duckula.State.Responding]: {
      entry: [
        actions.log((_, e) => `states.Responding.entry "${JSON.stringify(e)}"`, duckula.id),
        Mailbox.actions.reply((_, e) => e),
      ],
      always: duckula.State.Idle,
    },
  },
})

export default machine
