/* eslint-disable sort-keys */
import {
  createMachine,
  actions,
}                   from 'xstate'

import * as mailbox from './mailbox.js'

const states = {
  awake    : 'child/awake',
  sleeping : 'child/sleeping',
} as const

const types = {
  PEE   : 'child/PEE',
  SLEEP : 'child/SLEEP',
} as const

const events = {
  PEE   : ()            => ({ type: types.PEE       }),
  SLEEP : (ms: number)  => ({ type: types.SLEEP, ms }),
}

type ChildContext = { ms?: number }
type ChildEvent   = ReturnType<typeof events.SLEEP>

const machine = createMachine<ChildContext, ChildEvent, any>({
  context: {},
  id: 'child',
  initial: states.awake,
  states: {
    [states.awake]: {
      entry: [
        actions.log('states.awake.entry', 'ChildMachine'),
        actions.sendParent(mailbox.events.IDLE()),
      ],
      on: {
        [types.SLEEP]: {
          target: states.sleeping,
          actions: [
            actions.log((_, e) => `states.awake.on.sleep.actions ${JSON.stringify(e)}`, 'ChildMachine'),
          ],
        },
      },
      exit: [
        actions.log('states.awake.exit', 'ChildMachine'),
      ],
    },
    [states.sleeping]: {
      entry: [
        actions.log((_, e) => `states.sleeping.entry ${JSON.stringify(e)}`, 'ChildMachine'),
        actions.assign({ ms: (_, e) => e.ms }),
      ],
      after: {
        peeMs: {
          actions: actions.sendParent(events.PEE()),
        },
        ms: states.awake,
      },
      exit: [
        actions.log(_ => 'states.sleeping.exit', 'ChildMachine'),
        actions.assign({ ms: _ => undefined }),
      ],
    },
  },
}, {
  delays: {
    peeMs: ctx => {
      const ms = Math.floor(Number(ctx.ms) / 2)
      console.info('ChildMachine preMs', ms)
      return ms
    },
    ms: ctx => {
      const ms = Number(ctx.ms)
      console.info('ChildMachine ms', ms)
      return ms
    },
  },
})

export {
  events,
  machine,
  states,
  types,
}
