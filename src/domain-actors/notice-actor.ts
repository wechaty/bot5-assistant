/* eslint-disable sort-keys */
/**
 * Finite State Machine for BOT Friday Club Meeting
 *  @link https://github.com/wechaty/bot5-assistant
 */
import { createMachine, actions }   from 'xstate'
import { isActionOf }               from 'typesafe-actions'
import * as CQRS                    from 'wechaty-cqrs'

import * as duck    from '../duck/mod.js'

const Type = {
  CONVERSATION         : duck.Type.CONVERSATION,
  IDLE                 : duck.Type.IDLE,
  NOTICE               : duck.Type.NOTICE,
  SEND_MESSAGE_COMMAND : CQRS.duck.types.SEND_MESSAGE_COMMAND,
} as const

// eslint-disable-next-line no-redeclare
type Type = typeof Type[keyof typeof Type]

const Event = {
  CONVERSATION         : duck.Event.CONVERSATION,
  IDLE                 : duck.Event.IDLE,
  NOTICE               : duck.Event.NOTICE,
  SEND_MESSAGE_COMMAND : CQRS.duck.actions.sendMessageCommand,
} as const

// eslint-disable-next-line no-redeclare
type Event = {
  [key in keyof typeof Event]: ReturnType<typeof Event[key]>
}

const State = {
  Idle         : duck.State.Idle,
  initializing : duck.State.initializing,
  noticing     : duck.State.noticing,
  responding   : duck.State.responding,
} as const

// eslint-disable-next-line no-redeclare
type State = typeof State[keyof typeof State]

interface Context {
  conversationId?: string,
  address?: {
    wechaty: string,
  },
}

function initialContext (): Context {
  const context: Context = {
    conversationId: undefined,
    address: undefined,
  }
  return JSON.parse(JSON.stringify(context))
}

const ID = 'NoticeMachine'

const machine = createMachine<Context, Event[keyof Event]>({
  id: ID,
  context: () => initialContext(),
  initial: State.initializing,
  states: {
    [State.initializing]: {
      always: State.Idle,
    },
    [State.Idle]: {
      on: {
        '*': {
          // actions: actions.forwardTo(String(wechatyAddress)),
          target: State.Idle,  // enforce external transition
        },
        [Type.NOTICE]: State.noticing,
        [Type.CONVERSATION]: {
          actions: [
            actions.log((_, e) => `State.Idle.on.CONVERSATION ${e.payload.conversationId}`, ID),
            actions.assign({
              conversationId: (_, e) => e.payload.conversationId,
            }),
          ],
          target: State.Idle,  // enforce external transition
        },
      },
    },
    [State.noticing]: {
      entry: [
        actions.log('State.noticing.entry', ID),
        actions.send(
          (ctx, e) => isActionOf(Event.NOTICE, e) && ctx.conversationId
            ? CQRS.commands.SendMessageCommand(
              CQRS.uuid.NIL,
              ctx.conversationId,
              CQRS.sayables.text(
                `【信使系统】${e.payload.notice}`,
              ),
            )
            : Event.IDLE('State.noticing.entry not NOTICE'),
        ),
      ],
      on: {
        [Type.IDLE]: State.Idle,
        [Type.SEND_MESSAGE_COMMAND]: State.responding,
      },
    },
    [State.responding]: {
      entry: [
        actions.send(
          (_, e) => e,
          { to: ctx => ctx.address!.wechaty },
        ),
      ],
      always: State.Idle,
    },
  },
})

export {
  ID,
  Type,
  Event,
  State,
  machine,
  type Context,
  initialContext,
}
