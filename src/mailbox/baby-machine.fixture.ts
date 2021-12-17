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
  id: 'baby',
  initial: states.awake,
  states: {
    [states.awake]: {
      entry: [
        actions.log('states.awake.entry', 'BabyMachine'),
        actions.sendParent(mailbox.events.IDLE('BabyMachine.states.awake')),
        actions.sendParent(events.PLAY()),
      ],
      on: {
        /**
         * Huan(202112):
         *  always send parent a IDLE event if the child received a event that it does not care.
         *
         * This behavior is required for mailbox children, and it is very important because
         *  the mailbox need to know whether the child is idle or not
         *    by waiting a IDLE event feedback whenever it has sent an event to the child.
         */
        '*': {
          actions: [
            actions.log((_, e) => 'states.awake.on.any event: ' + e.type, 'BabyMachine'),
            actions.sendParent((_, e) => mailbox.events.IDLE(`BabyMachine.states.awake.on.any sendParent ${e.type}`)),
            // actions.choose([
            //   /**
            //    * FIXME: can we always send IDLE?
            //    * TODO: make it cleaner
            //    */
            //   /**
            //    * 1. if the event is either a mailbox event or a child event,
            //    *  then do not send it back to parent
            //    */
            //   {
            //     cond: (_, e) => [
            //       ...Object.values(mailbox.types),
            //       ...Object.values(types),
            //     ].includes(e.type as any),
            //     actions: [
            //       actions.log((_, e) => 'states.awake.on.any sendParent skipped for ' + JSON.stringify(e), 'BabyMachine'),
            //       actions.sendParent((_, e) => mailbox.events.IDLE('BabyMachine.states.awake.on.* unrelated event: ' + JSON.stringify(e))),
            //     ],
            //   },
            //   /**
            //    * 2. if the event is nether a mailbox event nor a child event,
            //    *  then send a IDLE event back to parent
            //    *  to identify that the child is IDLE
            //    */
            //   {
            //     actions: [
            //       actions.log((_, e) => 'states.awake.on.any sendParent ' + JSON.stringify(e), 'BabyMachine'),
            //       actions.sendParent((_, e) => {
            //         console.info(JSON.stringify(e))
            //         return mailbox.events.IDLE('BabyMachine.states.awake.on.*')
            //       }),
            //     ],
            //   },
            // ]),
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
