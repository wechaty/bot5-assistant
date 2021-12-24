/* eslint-disable sort-keys */
import {
  createMachine,
  actions,
}                   from 'xstate'

import type {
  sinon,
}           from 'tstest'

const spyActionsMachine = (spy: sinon.SinonSpy) => createMachine<{ lastSetBy: string }>({
  initial: 'step0',
  context: {
    lastSetBy: 'initializing',
  },
  /**
   * Issue statelyai/xstate#2891:
   *  The context provided to the expr inside a State
   *  should be exactly the **context in this state**
   *
   * @see https://github.com/statelyai/xstate/issues/2891
   */
  preserveActionOrder: true,
  states: {
    step0: {
      entry: [
        actions.assign({ lastSetBy: _ => { spy('states.step0.entry.assign'); return 'states.step0.entry.assign' } }),
        ctx => spy('states.step0.entry.expr context.lastSetBy:' + ctx.lastSetBy),
      ],
      exit: [
        actions.assign({ lastSetBy: _ => { spy('states.step0.exit.assign'); return 'states.step0.exit.assign' } }),
        ctx => spy('states.step0.exit.expr context.lastSetBy:' + ctx.lastSetBy),
      ],
      on: {
        '*': {
          target: 'step1',
          actions: [
            actions.assign({ lastSetBy: _ => { spy('states.step0.on.assign'); return 'states.step0.on.assign' } }),
            ctx => spy('states.step0.on.expr context.lastSetBy:' + ctx.lastSetBy),
          ],
        },
      },
    },
    step1: {
      entry: [
        actions.assign({ lastSetBy: _ => { spy('states.step1.entry.assign'); return 'states.step1.entry.assign' } }),
        ctx => spy('states.step1.entry.expr context.lastSetBy:' + ctx.lastSetBy),
      ],
      always: 'step2',
      exit: [
        actions.assign({ lastSetBy: _ => { spy('states.step1.exit.assign'); return 'states.step1.exit.assign' } }),
        ctx => spy('states.step1.exit.expr context.lastSetBy:' + ctx.lastSetBy),
      ],
    },
    step2: {
      entry: [
        actions.assign({ lastSetBy: _ => { spy('states.step2.entry.assign'); return 'states.step2.entry.assign' } }),
        ctx => spy('states.step2.entry.expr context.lastSetBy:' + ctx.lastSetBy),
      ],
      after: {
        0: {
          target: 'step3',
          actions: [
            actions.assign({ lastSetBy: _ => { spy('states.step2.after.assign'); return 'states.step2.after.assign' } }),
            ctx => spy('states.step2.after.expr context.lastSetBy:' + ctx.lastSetBy),
          ],
        },
      },
      exit: [
        actions.assign({ lastSetBy: _ => { spy('states.step2.exit.assign'); return 'states.step2.exit.assign' } }),
        ctx => spy('states.step2.exit.expr context.lastSetBy:' + ctx.lastSetBy),
      ],
    },
    step3: {
      entry: [
        actions.assign({ lastSetBy: _ => { spy('states.step3.entry.assign'); return 'states.step3.entry.assign' } }),
        ctx => spy('states.step3.entry.expr context.lastSetBy:' + ctx.lastSetBy),
      ],
      type: 'final',
    },
  },
})

export {
  spyActionsMachine,
}
