/* eslint-disable sort-keys */
import {
  createMachine,
  actions,
}                   from 'xstate'

import * as Mailbox from './mod.js'

enum States {
  idle = 'idle',
  busy = 'busy',
}

enum Types {
  MAKE_ME_COFFEE = 'MAKE_ME_COFFEE',
  COFFEE         = 'COFFEE',
}

const Events = {
  MAKE_ME_COFFEE : (customer: string) => ({ type: Types.MAKE_ME_COFFEE, customer }) as const,
  COFFEE         : (customer: string) => ({ type: Types.COFFEE, customer })         as const,
} as const

interface Context {
  customer?: string,
}
type Event = ReturnType<typeof Events[keyof typeof Events]>

const DELAY_MS = 10

const machine = createMachine<Context, Event>({
  context: {
    customer: undefined,
  },
  initial: States.idle,
  states: {
    [States.idle]: {
      entry: Mailbox.Actions.idle('CoffeeMaker')('idle'),
      on: {
        [Types.MAKE_ME_COFFEE]: {
          target: States.busy,
          actions: actions.assign((_, e) => ({ customer: e.customer })),
        },
        '*': States.idle,
      },
    },
    [States.busy]: {
      entry: [
        actions.send(ctx => Events.COFFEE(ctx.customer!), {
          delay: DELAY_MS,
        }),
      ],
      on: {
        [Types.COFFEE]: {
          actions: Mailbox.Actions.reply((_, e) => e),
          target: States.idle,
        },
      },
      exit: actions.assign({ customer: _ => undefined }),
    },
  },
})

export {
  machine,
  Types,
  Events,
  DELAY_MS,
}
