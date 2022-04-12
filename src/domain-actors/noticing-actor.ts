/* eslint-disable sort-keys */
/**
 * Finite State Machine for BOT Friday Club Meeting
 *  @link https://github.com/wechaty/bot5-assistant
 */
import { createMachine, actions }   from 'xstate'
import { isActionOf }               from 'typesafe-actions'
import * as CQRS                    from 'wechaty-cqrs'

import * as duck    from '../duck/mod.js'
import { duckularize } from '../duckula/duckularize.js'

interface Context {
  conversationId?: string,
  address?: {
    wechaty: string,
  },
}

const duckula = duckularize({
  id: 'NoticingMachine',
  events: [ { ...duck.Event, ...CQRS.commands }, [
    'CONVERSATION',
    'IDLE',
    'NOTICE',
    'SendMessageCommand',
  ] ],
  states: [ duck.State, [
    'Idle',
    'initializing',
    'noticing',
    'responding',
  ] ],
  initialContext: ({}) as Context,
})

const machine = createMachine<
  Context,
  ReturnType<typeof duckula.Event[keyof typeof duckula.Event]>
>({
  id: duckula.ID,
  initial: duckula.State.initializing,
  states: {
    [duckula.State.initializing]: {
      always: duckula.State.Idle,
    },
    [duckula.State.Idle]: {
      on: {
        '*': {
          // actions: actions.forwardTo(String(wechatyAddress)),
          target: duckula.State.Idle,  // enforce external transition
        },
        [duckula.Type.NOTICE]: duckula.State.noticing,
        [duckula.Type.CONVERSATION]: {
          actions: [
            actions.log((_, e) => `duckula.State.Idle.on.CONVERSATION ${e.payload.conversationId}`, duckula.ID),
            actions.assign({
              conversationId: (_, e) => e.payload.conversationId,
            }),
          ],
          target: duckula.State.Idle,  // enforce external transition
        },
      },
    },
    [duckula.State.noticing]: {
      entry: [
        actions.log('duckula.State.noticing.entry', duckula.ID),
        actions.send(
          (ctx, e) => isActionOf(duckula.Event.NOTICE, e) && ctx.conversationId
            ? CQRS.commands.SendMessageCommand(
              CQRS.uuid.NIL,
              ctx.conversationId,
              CQRS.sayables.text(
                `【信使系统】${e.payload.notice}`,
              ),
            )
            : duckula.Event.IDLE('duckula.State.noticing.entry not NOTICE'),
        ),
      ],
      on: {
        [duckula.Type.IDLE]: duckula.State.Idle,
        [duckula.Type.SendMessageCommand]: duckula.State.responding,
      },
    },
    [duckula.State.responding]: {
      entry: [
        actions.send(
          (_, e) => e,
          { to: ctx => ctx.address!.wechaty },
        ),
      ],
      always: duckula.State.Idle,
    },
  },
})

duckula.machine = machine
export default duckula as Required<typeof duckula>
