/* eslint-disable sort-keys */
import {
  createMachine,
  actions,
}                   from 'xstate'

import * as mailbox from './mailbox.js'

enum States {
  awake    = 'baby/awake',
  sleeping = 'baby/sleeping',
}

enum Types {
  SLEEP = 'baby/SLEEP',
  // sleeping
  DREAM = 'baby/DREAM',
  CRY   = 'baby/CRY',
  PEE   = 'baby/PEE',
  // awake
  PLAY = 'baby/PLAY',
  REST = 'baby/REST',
  EAT  = 'baby/EAT',
}

const events = {
  SLEEP : (ms: number)  => ({ type: Types.SLEEP, ms }),
  // sleeping
  DREAM : ()  => ({ type: Types.DREAM }),
  CRY   : ()  => ({ type: Types.CRY   }),
  PEE   : ()  => ({ type: Types.PEE   }),
  // awake
  PLAY : () => ({ type: Types.PLAY  }),
  REST : () => ({ type: Types.REST  }),
  EAT  : () => ({ type: Types.EAT   }),
}

type BabyContext = { ms?: number }
type BabyEvent   = ReturnType<typeof events.SLEEP>

const machine = createMachine<BabyContext, BabyEvent, any>({
  context: {},
  id: 'baby',
  initial: States.awake,
  states: {
    [States.awake]: {
      entry: [
        actions.log('states.awake.entry', 'BabyMachine'),
        actions.sendParent(mailbox.Events.IDLE('BabyMachine.states.awake')),
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
            actions.log((_, __, { _event }) => 'states.awake.on.any event: ' + JSON.stringify(_event), 'BabyMachine'),
            /**
             * Huan(202112): child state machine should not send the event to parent
             *  when the event might be sent from the chid machine to the parent machine.
             *  to prevent deadloop
             */
            actions.choose([
              /**
               * 1. if the event is either a mailbox event or a child event,
               *  then do not send it back to parent again, to prevent the deadloop
               */
              {
                cond: (_, e) => [
                  ...Object.values<string>(mailbox.Types),
                  ...Object.values<string>(Types),
                ].includes(e.type),
                actions: [
                  actions.log((_, e) => 'states.awake.on.any sendParent skipped for ' + JSON.stringify(e), 'BabyMachine'),
                ],
              },
              /**
               * 2. if the event is nether a mailbox event nor a child event,
               *  then send a IDLE event back to parent
               *  to identify that the child is IDLE
               */
              {
                actions: [
                  actions.log((_, e) => 'states.awake.on.any sendParent ' + JSON.stringify(e), 'BabyMachine'),
                  actions.sendParent((_, e) => {
                    console.info(JSON.stringify(e))
                    return mailbox.Events.IDLE('BabyMachine.states.awake.on.*')
                  }),
                ],
              },
            ]),
          ],
        },
        [Types.SLEEP]: {
          target: States.sleeping,
          actions: [
            actions.log((_, e) => `states.awake.on.sleep.actions ${JSON.stringify(e)}`, 'BabyMachine'),
            actions.sendParent(events.REST()),
          ],
        },
      },
      exit: [
        actions.log('states.awake.exit', 'BabyMachine'),
        /**
         * FIXME: Huan(202112): uncomment the below `sendParent` line
         *  https://github.com/statelyai/xstate/issues/2880
         */
        // actions.sendParent(events.EAT()),
      ],
    },
    [States.sleeping]: {
      entry: [
        actions.log((_, e) => `states.sleeping.entry ${JSON.stringify(e)}`, 'BabyMachine'),
        actions.assign({ ms: (_, e) => e.ms }),
        actions.sendParent(events.DREAM()),
      ],
      after: {
        cryMs: {
          actions: actions.sendParent(events.CRY()),
        },
        ms: States.awake,
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
  States,
  Types,
}
