/* eslint-disable sort-keys */
import { createMachine, actions }   from 'xstate'
import * as Mailbox                 from 'mailbox'
import { GError }                   from 'gerror'
import * as PUPPET                  from 'wechaty-puppet'

import * as messageToTextActor from '../message-to-text/mod.js'

import duckula from './duckula.js'

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
     *  1. receive MESSAGE -> transition to Mesaging
     *
     */
    [duckula.State.Idle]: {
      entry: [
        actions.assign({ talkerId: undefined }),
        Mailbox.actions.idle(duckula.id)('idle'),
      ],
      on: {
        [duckula.Type.MESSAGE]: {
          actions: actions.assign({
            talkerId: (_, e) => e.payload.message.talkerId,
          }),
          target: duckula.State.Messaging,
        },
      },
    },

    [duckula.State.Messaging]: {
      TODO: wip
    },

    [duckula.State.Feedbacking]: {
      entry: [
        actions.send((ctx, e) =>
          duckula.Event.FEEDBACK(
            ctx.talkerId!,
            (e as ReturnType<typeof duckula.Event.TEXT>).payload.text,
          ),
        ),
      ],
      on: {
        [duckula.Type.FEEDBACK]: duckula.State.Responding,
      },
    },

    [duckula.State.Erroring]: {
      entry: [
        actions.send((ctx, e) =>
          duckula.Event.FEEDBACK(
            ctx.talkerId!,
            (e as ReturnType<typeof duckula.Event.GERROR>).payload.gerror,
          ),
        ),
      ],
      on: {
        [duckula.Type.FEEDBACK]: duckula.State.Feedbacking,
      },
    },

    [duckula.State.Responding]: {
      entry: [
        actions.log((_, e) => `states.Responding.entry ${(e as ReturnType<typeof duckula.Event.FEEDBACK>).payload.feedback}`, duckula.id),
        Mailbox.actions.reply((_, e) => e),
      ],
      always: duckula.State.Idle,
    },
  },
})

export default machine
