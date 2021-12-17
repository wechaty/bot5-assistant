/* eslint-disable sort-keys */
import {
  createMachine,
  actions,
}                   from 'xstate'

import * as mailbox from './mailbox.js'

const states = {
  awake    : 'baby/awake',
  sleeping : 'baby/sleeping',
} as const

const types = {
  SLEEP : 'baby/SLEEP',
  // sleeping
  DREAM : 'baby/DREAM',
  CRY   : 'baby/CRY',
  PEE   : 'baby/PEE',
  // awake
  PLAY : 'baby/PLAY',
  REST : 'baby/REST',
  EAT  : 'baby/EAT',
} as const

const events = {
  SLEEP : (ms: number)  => ({ type: types.SLEEP, ms }),
  // sleeping
  DREAM : ()  => ({ type: types.DREAM }),
  CRY   : ()  => ({ type: types.CRY   }),
  PEE   : ()  => ({ type: types.PEE   }),
  // awake
  PLAY : () => ({ type: types.PLAY  }),
  REST : () => ({ type: types.REST  }),
  EAT  : () => ({ type: types.EAT   }),
}

type BabyContext = { ms?: number }
type BabyEvent   = ReturnType<typeof events.SLEEP>

const machine = createMachine<BabyContext, BabyEvent, any>({
  context: {},
  id: 'child',
  initial: states.awake,
  states: {
    [states.awake]: {
      entry: [
        actions.log('states.awake.entry', 'BabyMachine'),
        actions.sendParent(mailbox.events.IDLE('BabyMachine.states.awake')),
        actions.sendParent(events.PLAY()),
      ],
      on: {
        '*': {
          actions: [
            actions.log('states.awake.on.any', 'BabyMachine'),
            actions.sendParent(mailbox.events.IDLE('BabyMachine.states.awake.on.*')),
          ],
        },
        [types.SLEEP]: {
          target: states.sleeping,
          actions: [
            actions.log((_, e) => `states.awake.on.sleep.actions ${JSON.stringify(e)}`, 'BabyMachine'),
            actions.sendParent(events.REST()),
          ],
        },
      },
      exit: [
        actions.log('states.awake.exit', 'BabyMachine'),
        actions.sendParent(events.EAT()),
      ],
    },
    [states.sleeping]: {
      entry: [
        actions.log((_, e) => `states.sleeping.entry ${JSON.stringify(e)}`, 'BabyMachine'),
        actions.assign({ ms: (_, e) => e.ms }),
        actions.sendParent(events.DREAM()),
      ],
      after: {
        cryMs: {
          actions: actions.sendParent(events.CRY()),
        },
        ms: states.awake,
      },
      exit: [
        actions.log(_ => 'states.sleeping.exit', 'BabyMachine'),
        actions.assign({ ms: _ => undefined }),
        actions.sendParent(events.PEE()),
      ],
    },
  },
}, {
  delays: {
    cryMs: ctx => {
      const ms = Math.floor(Number(ctx.ms) / 2)
      console.info('BabyMachine preMs', ms)
      return ms
    },
    ms: ctx => {
      const ms = Number(ctx.ms)
      console.info('BabyMachine ms', ms)
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
