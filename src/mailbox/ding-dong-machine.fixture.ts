/* eslint-disable sort-keys */
import {
  createMachine,
  actions,
}                   from 'xstate'

import * as Mailbox from './mod.js'

enum States {
  idle = 'ding-dong/idle',
  busy = 'ding-dong/busy',
}

enum Types {
  DING = 'ding-dong/DING',
  DONG = 'ding-dong/DONG',
}

const Events = {
  DING : (i: number) => ({ type: Types.DING, i }) as const,
  DONG : (i: number) => ({ type: Types.DONG, i }) as const,
} as const

interface Context {
  i: number,
}
type Event =
  | ReturnType<typeof Events.DING>
  | ReturnType<typeof Events.DONG>

const MAX_DELAY_MS = 10

const machine = createMachine<Context, Event>({
  initial: States.idle,
  context: {
    i: -1,
  },
  states: {
    [States.idle]: {
      entry: [
        Mailbox.Actions.receive('ding-dong'),
      ],
      on: {
        '*': States.idle,
        [Types.DING]: {
          target: States.busy,
          actions: actions.assign({
            i: (_, e) => e.i,
          }),
        },
      },
    },
    [States.busy]: {
      after: {
        randomMs: {
          actions: [
            actions.sendParent(ctx => Events.DONG(ctx.i)),
          ],
          target: States.idle,
        },
      },
    },
  },
}, {
  delays: {
    randomMs: _ => Math.floor(Math.random() * MAX_DELAY_MS),
  },
})

export {
  machine,
  Events,
  States,
  Types,
}
