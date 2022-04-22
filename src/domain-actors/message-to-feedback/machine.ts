/* eslint-disable sort-keys */
import { createMachine, actions }   from 'xstate'
import * as Mailbox                 from 'mailbox'
import { GError }                   from 'gerror'
import * as PUPPET                  from 'wechaty-puppet'

import * as messageToTextActor from '../../application-actors/message-to-text/mod.js'

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
      invoke: {
        id: messageToTextActor.id,
        src: ctx => messageToTextActor.machine.withContext({
          ...messageToTextActor.initialContext(),
          address: {
            wechaty: ctx.address.wechaty,
          },
        }),
        onDone:   { actions: actions.send((_, e) => duckula.Event.GERROR(GError.stringify(e.data))) },
        onError:  { actions: actions.send((_, e) => duckula.Event.GERROR(GError.stringify(e.data))) },
      },
      entry: [
        actions.log((_, e) => `states.Messaging.entry MESSAGE type ${PUPPET.types.Message[(e as ReturnType<typeof duckula.Event.MESSAGE>).payload.message.type]}`, duckula.id),
        actions.send((_, e) => e, { to: messageToTextActor.id }),
      ],
      on: {
        [duckula.Type.ACTOR_REPLY]: {
          actions: [
            actions.log((_, e) => `state.Messaging.on.ACTOR_REPLY [${e.payload.message.type}]`, duckula.id),
            actions.send((_, e) => e.payload.message),
          ],
        },
        [duckula.Type.TEXT]: duckula.State.Feedbacking,
        [duckula.Type.GERROR]: duckula.State.Erroring,
      },
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
