/* eslint-disable sort-keys */
import {
  createMachine,
  actions,
}                   from 'xstate'

import type {
  sinon,
}           from 'tstest'

const spyTransitionMachine = (spy: sinon.SinonSpy) => createMachine<{ data: string }>({
  initial: 'step0',
  context: {
    data: 'step0',
  },
  states: {
    step0: {
      entry: [
        actions.assign({ data: _ => { spy('step0-entry.assign'); return 'step0-entry.assign' } }),
        ctx => spy('step0-entry.func: ' + ctx.data),
      ],
      exit: [
        actions.assign({ data: _ => { spy('step0-exit.assign'); return 'step0-exit.assign' } }),
        ctx => spy('step0-exit.func: ' + ctx.data),
      ],
      on: {
        '*': {
          target: 'step1',
          actions: [
            actions.assign({ data: _ => { spy('step0-on.assign'); return 'step0-on.assign' } }),
            ctx => spy('step0-on.func: ' + ctx.data),
          ],
        },
      },
    },
    step1: {
      entry: [
        actions.assign({ data: _ => { spy('step1-entry.assign'); return 'step1-entry.assign' } }),
        ctx => spy('step1-entry.func: ' + ctx.data),
      ],
      always: 'step2',
      exit: [
        actions.assign({ data: _ => { spy('step1-exit.assign'); return 'step1-exit.assign' } }),
        ctx => spy('step1-exit.func: ' + ctx.data),
      ],
    },
    step2: {
      entry: [
        actions.assign({ data: _ => { spy('step2-entry.assign'); return 'step2-entry.assign' } }),
        ctx => spy('step2-entry.func: ' + ctx.data),
      ],
      after: {
        0: {
          target: 'step10',
          actions: [
            actions.assign({ data: _ => { spy('step2-after.assign'); return 'step2-after.assign' } }),
            ctx => spy('step2-after.func: ' + ctx.data),
          ],
        },
      },
      exit: [
        actions.assign({ data: _ => { spy('step2-exit.assign'); return 'step2-exit.assign' } }),
        ctx => spy('step2-exit.func: ' + ctx.data),
      ],
    },
    step10: {
      type: 'final',
    },
  },
})

export {
  spyTransitionMachine,
}
