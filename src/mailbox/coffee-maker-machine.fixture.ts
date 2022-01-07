/* eslint-disable sort-keys */
import {
  createMachine,
  actions,
}                   from 'xstate'

import * as Mailbox from './mod.js'

enum States {
  idle          = 'idle',
  gettingCup    = 'gettingCup',
  fillingCoffee = 'fillingCoffee',
  delivering    = 'delivering'
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
  customer: null | string,
}
type Event = ReturnType<typeof Events[keyof typeof Events]>

const machine = createMachine<Context, Event>({
  context: {
    customer: null,
  },
  initial: States.idle,
  states: {
    [States.idle]: {
      entry: Mailbox.Actions.idle('CoffeeMaker')('idle'),
      on: {
        [Types.MAKE_ME_COFFEE]: {
          target: States.gettingCup,
          actions: actions.assign((_, e) => ({ customer: e.customer })),
        },
        '*': States.idle,
      },
    },
    [States.gettingCup]: {
      after: {
        10: States.fillingCoffee,
      },
    },
    [States.fillingCoffee]: {
      after: {
        10: States.delivering,
      },
    },
    [States.delivering]: {
      entry: Mailbox.Actions.reply(ctx => Events.COFFEE(ctx.customer || 'NO CUSTOMER')),
      after: {
        10: States.idle,
      },
      exit: actions.assign({ customer: _ => null }),
    },
  },
})

export {
  machine,
  Types,
  Events,
}
