/* eslint-disable sort-keys */
/**
 * Finite State Machine for BOT Friday Club Meeting
 *  @link https://github.com/wechaty/bot5-assistant
 */
import { createMachine, actions }   from 'xstate'
import * as CQRS                    from 'wechaty-cqrs'
import * as Mailbox                 from 'mailbox'

import duckula    from './duckula.js'

const machine = createMachine<
  ReturnType<typeof duckula.initialContext>,
  ReturnType<typeof duckula.Event[keyof typeof duckula.Event]>
>({
  id: duckula.id,
  initial: duckula.State.Initializing,
  context: duckula.initialContext,
  states: {
    [duckula.State.Initializing]: {
      always: duckula.State.Idle,
    },

    [duckula.State.Idle]: {
      entry: [
        Mailbox.actions.idle(duckula.id)('idle'),
      ],
      on: {
        '*': {
          target: duckula.State.Idle,  // enforce external transition
        },
        [duckula.Type.NOTICE]: duckula.State.Noticing,
        [duckula.Type.CONVERSATION]: {
          actions: [
            actions.log((_, e) => `duckula.State.Idle.on.CONVERSATION ${e.payload.conversationId}`, duckula.id),
            actions.assign({
              conversationId: (_, e) => e.payload.conversationId,
            }),
          ],
          target: duckula.State.Idle,  // enforce external transition
        },
      },
    },

    [duckula.State.Noticing]: {
      entry: [
        actions.log('duckula.State.Noticing.entry', duckula.id),
        actions.choose<ReturnType<typeof duckula.initialContext>, ReturnType<typeof duckula.Event.NOTICE>>([
          {
            cond: ctx => !!ctx.conversationId,
            actions: [
              actions.send(
                (ctx, e) => CQRS.commands.SendMessageCommand(
                  CQRS.uuid.NIL,
                  ctx.conversationId!,
                  CQRS.sayables.text(
                    `【系统通知】${e.payload.text}`,
                    e.payload.mentions,
                  ),
                ),
                { to: ctx => ctx.address.wechaty },
              ),
            ],
          },
          {
            actions: actions.log('duckula.State.Noticing.entry no conversationId', duckula.id),
          },
        ]),
      ],
      always: duckula.State.Idle,
    },

  },
})

export default machine
