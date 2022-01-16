/* eslint-disable sort-keys */
import {
  createMachine,
  actions,
}                   from 'xstate'

import { Actions as MailboxActions } from './actions.js'

enum States {
  awake   = 'baby/awake',
  asleep  = 'baby/asleep',
}

enum Types {
  SLEEP = 'baby/SLEEP',
  // asleep
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
  // asleep
  DREAM : ()  => ({ type: Types.DREAM }),
  CRY   : ()  => ({ type: Types.CRY   }),
  PEE   : ()  => ({ type: Types.PEE   }),
  // awake
  PLAY : () => ({ type: Types.PLAY  }),
  REST : () => ({ type: Types.REST  }),
  EAT  : () => ({ type: Types.EAT   }),
}

type Context = { ms?: number }
type Event   = ReturnType<typeof Events.SLEEP>

const MACHINE_NAME = 'BabyMachine'

/**
 * AWAKE
 *  - PLAY
 *  - EAT, REST <- SLEEP
 *  -
 * ASLEEP
 *  - DREAM
 *  - CRY
 *  - PEE
 */
const machine = createMachine<Context, Event, any>({
  context: {},
  id: 'baby',
  initial: States.awake,
  states: {
    [States.awake]: {
      entry: [
        actions.log((_, e, { _event }) => `states.awake.entry <- [${e.type}]@${_event.origin}`, MACHINE_NAME),
        MailboxActions.idle(MACHINE_NAME)('awake'),
        MailboxActions.reply(Events.PLAY()),
      ],
      exit: [
        actions.log('states.awake.exit', MACHINE_NAME),
        /**
         * FIXME: Huan(202112): uncomment the below `sendParent` line
         *  https://github.com/statelyai/xstate/issues/2880
         */
        // actions.sendParent(events.EAT()),
        MailboxActions.reply(Events.EAT()),
      ],
      on: {
        /**
         * Huan(202112):
         *  always send parent a IDLE event if the target machine received a event if it does not care it at all.
         *
         * This behavior is required for mailbox target, and it is very important because
         *  the mailbox need to know whether the target is idle or not
         *    by waiting a IDLE event feedback whenever it has sent an event to the target.
         */
        '*': {
          target: States.awake,
          actions: [
            actions.log((_, e, { _event }) => `states.awake.on.* <- [${e.type}]@${_event.origin || ''}`, MACHINE_NAME),
          ],
        },
        [Types.SLEEP]: {
          target: States.asleep,
          actions: [
            actions.log((_, e) => `states.awake.on.SLEEP ${JSON.stringify(e)}`, MACHINE_NAME),
            MailboxActions.reply(Events.REST()),
          ],
        },
      },
    },
    [States.asleep]: {
      entry: [
        actions.log((_, e) => `states.asleep.entry ${JSON.stringify(e)}`, MACHINE_NAME),
        // Huan(202112): move this assign to previous state.on(SLEEP)
        //  FIXME: `(parameter) e: never` (after move to previous state.on.SLEEP)
        actions.assign({ ms: (_, e) => e.ms }),
        MailboxActions.reply(Events.DREAM()),
      ],
      exit: [
        actions.log(_ => 'states.asleep.exit', MACHINE_NAME),
        actions.assign({ ms: _ => undefined }),
        MailboxActions.reply(Events.PEE()),
      ],
      after: {
        cryMs: {
          actions: MailboxActions.reply(Events.CRY()),
        },
        ms: States.awake,
      },
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
  type Context,
  Events,
  machine,
  States,
  Types,
}
