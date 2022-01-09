/* eslint-disable sort-keys */
import {
  actions,
  createMachine,
}                   from 'xstate'
import {
  isActionOf,
}                   from 'typesafe-actions'
import type { Logger } from 'brolog'
import type {
  Wechaty,
}                   from 'wechaty'
import { GError }   from 'gerror'

import {
  Events as Bot5Events,
  States,
  Types,
}                     from '../schemas/mod.js'
import * as Mailbox   from '../mailbox/mod.js'
import { InjectionToken } from '../ioc/tokens.js'

export interface Context {
  gerror?: string
}

const Events = {
  MESSAGE : Bot5Events.MESSAGE,
  RESET   : Bot5Events.RESET,
  SAY     : Bot5Events.SAY,
} as const

type Event = ReturnType<typeof Events[keyof typeof Events]>

/**
 * use JSON.parse() to prevent the initial context from being changed
 */
function initialContext (): Context {
  const context: Context = {
    gerror: undefined,
  }
  return JSON.parse(JSON.stringify(context))
}

const MACHINE_NAME = 'WechatyMachine'

const machineFactory = (
  wechaty : Wechaty,
  logger  : Mailbox.Options['logger'],
) => createMachine<Context, Event>({
  id: MACHINE_NAME,
  context: initialContext(),
  /**
   * Issue statelyai/xstate#2891:
   *  The context provided to the expr inside a State
   *  should be exactly the **context in this state**
   * @see https://github.com/statelyai/xstate/issues/2891
   */
  preserveActionOrder: true,
  initial: States.initializing,
  states: {
    [States.initializing]: {
      always: States.idle,
    },
    [States.idle]: {
      entry: [
        actions.log('state.idle.entry', MACHINE_NAME),
        Mailbox.Actions.idle(MACHINE_NAME)('idle'),
      ],
      on: {
        '*': States.idle, // must have a external transition for all events
        [Types.RESET]: {
          actions: actions.assign(initialContext()) as any,
          target: States.initializing,
        },
        [Types.SAY]: States.busy,
      },
    },
    [States.erroring]: {
      entry: Mailbox.Actions.reply(ctx => Bot5Events.ERROR(ctx.gerror!)),
      exit: actions.assign({ gerror: _ => undefined }),
      always: States.idle,
    },
    [States.busy]: {
      entry: [
        actions.log((_, e) => `state.busy.entry ${e.type}`, MACHINE_NAME),
      ],
      invoke: {
        src: async (_, e) => {
          if (isActionOf(Events.SAY, e)) {
            await wechaty.puppet.messageSendText(
              e.payload.conversation,
              e.payload.text,
              e.payload.mentions,
            )
          } else {
            logger && logger(MACHINE_NAME + ' state.busy.invoke unknown event type: ' + e.type)
          }
        },
        onDone: States.idle,
        onError: {
          actions: actions.assign({
            gerror: (_, e) => GError.stringify(e.data),
          }),
          target: States.erroring,
        }
      },
    },
  },
})

mailboxFactory.inject = [
  InjectionToken.Wechaty,
  InjectionToken.Logger,
] as const
function mailboxFactory (
  wechaty: Wechaty,
  logger: Mailbox.Options['logger'],
) {
  const machine = machineFactory(wechaty, logger)
  const mailbox = Mailbox.from(machine, { logger })

  mailbox.acquire()
  return mailbox
}

export {
  machineFactory,
  mailboxFactory,
  Events,
  initialContext,
}
