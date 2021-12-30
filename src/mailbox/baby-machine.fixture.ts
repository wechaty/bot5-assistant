/* eslint-disable sort-keys */
import {
  createMachine,
  actions,
}                   from 'xstate'

import { Types as MailboxTypes } from './types.js'
import { Events as MailboxEvents } from './events.js'
import { Actions as MailboxActions } from './actions.js'

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

const Events = {
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

type BabyContext = { ms?: null | number }
type BabyEvent   = ReturnType<typeof Events.SLEEP>

const machine = createMachine<BabyContext, BabyEvent, any>({
  context: {},
  id: 'baby',
  initial: States.awake,
  states: {
    [States.awake]: {
      entry: [
        actions.log((_, e, { _event }) => 'states.awake.entry ' + e.type + '@' + _event.origin, 'BabyMachine'),
        MailboxActions.sendParentIdle('BabyMachine.states.awake'),
        MailboxActions.reply(Events.PLAY())
        // actions.sendParent(events.PLAY()),
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
          target: States.awake,
          actions: [
            actions.log((_, e, { _event }) => 'states.awake.on.any ' + e.type + '@' + _event.origin, 'BabyMachine'),
          ]
        },
        [Types.SLEEP]: {
          target: States.sleeping,
          actions: [
            actions.log((_, e) => `states.awake.on.sleep.actions ${JSON.stringify(e)}`, 'BabyMachine'),
            MailboxActions.reply(Events.REST()),
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
        // Huan(202112): move this assign to previous state.on(SLEEP)
        // FIXME: `(parameter) e: never`
        actions.assign({ ms: (_, e) => e.ms }),
        MailboxActions.reply(Events.DREAM()),
      ],
      after: {
        cryMs: {
          actions: MailboxActions.reply(Events.CRY()),
        },
        ms: States.awake,
      },
      exit: [
        actions.log(_ => 'states.sleeping.exit', 'BabyMachine'),
        actions.assign({ ms: _ => null }),
        MailboxActions.reply(Events.PEE()),
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
  Events,
  machine,
  States,
  Types,
}
