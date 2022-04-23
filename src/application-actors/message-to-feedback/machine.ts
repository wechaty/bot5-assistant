/* eslint-disable sort-keys */
import { createMachine, actions }   from 'xstate'
import * as Mailbox                 from 'mailbox'

import * as messageToTextActor from '../message-to-text/mod.js'

import duckula, { Context, Event, Events } from './duckula.js'

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
          target: duckula.State.Textualizing,
        },
      },
    },

    [duckula.State.Textualizing]: {
      invoke: {
        id: messageToTextActor.id,
        src: ctx => messageToTextActor.machine.withContext({
          ...messageToTextActor.initialContext(),
          address: {
            wechaty: ctx.address.wechaty,
          },
        }),
      },
      entry: [
        actions.send((_, e) => e, { to: messageToTextActor.id }),
      ],
      on: {
        [duckula.Type.ACTOR_REPLY]: {
          actions: [
            actions.log((_, e) => `state.Textualizing.on.ACTOR_REPLY [${e.payload.message.type}]`, duckula.id),
            actions.send((_, e) => e.payload.message),
          ],
        },
        [duckula.Type.TEXT]: {
          actions: [
            actions.log((_, e) => `state.Textualizing.on.TEXT [${e.payload.text}]`, duckula.id),
            actions.send((ctx, e) => duckula.Event.FEEDBACK(
              ctx.talkerId!,
              e.payload.text,
            )),
          ],
        },
        [duckula.Type.FEEDBACK] : duckula.State.Responding,
        [duckula.Type.GERROR]   : duckula.State.Erroring,
      },
    },

    [duckula.State.Responding]: {
      entry: [
        actions.log<Context, Events['FEEDBACK']>((_, e) => `states.Responding.entry ${e.payload.feedback}`, duckula.id),
        Mailbox.actions.reply((_, e) => e),
      ],
      always: duckula.State.Idle,
    },

    [duckula.State.Erroring]: {
      entry: [
        actions.log<Context, Events['GERROR']>((_, e) => `states.Erroring.entry ${e.payload.gerror}`, duckula.id),
        Mailbox.actions.reply((_, e) => e),
      ],
      always: duckula.State.Idle,
    },

  },
})

export default machine
