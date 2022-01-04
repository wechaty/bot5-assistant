#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
import * as Mailbox from '../mod.js'
import {
  actions,
  createMachine,
  interpret,
  StateMachine,
}                   from 'xstate'

/**
 * We will create a machine, and test it by sending two events to it:
 *  1. without Mailbox, the machine will only be able to reponse the first event
 *  2. with Mailbox, the machine will be able to reponse all of the events, one by one.
 *
 * Obviously the Mailbox-ed machine is more conforming the Actor Model with distributed async tasks.
 *
 * Huan(202201) <https://github.com/huan/mailbox>
 */

/**
 * Create a test machine with `withMailbox` flag
 *  states: idle <> busy
 *  events: TASK -> TASK_RECEIVED
 */
const demoMachine = (withMailbox = false) => createMachine<{}>({
  id: 'demo',
  initial: 'idle',
  states: {
    idle: {
      /**
       * RULE #1: machine must put a `Mailbox.Actions.idle('machine-name')` action
       *  to the `entry` of the state which your machine can accept new messages,
       *  so that the Mailbox can know the machine are ready to receive new messages from other actors.
       */
      entry: actions.choose([{ cond: _ => withMailbox,
        actions: Mailbox.Actions.idle('machine-name'),
      }]),
      on: {
        '*': {
          /**
           * RULE #2: machine must use an external transision to the `idle` state
           *  when it finished processing any messages,
           *  to trigger the `entry` action run again.
           */
          target: 'idle',
          actions: actions.log('make sure the idle state will be re-entry with external trainsition when receiving event'),
        },
        TASK: 'busy',
      },
    },
    busy: {
      /**
       * RULE #3: machine use `Mailbox.Actions.reply(TASK_RECEIVED)`
       *  to reply TASK_RECEIVED (or any EVENTs) to other actors.
       */
      entry: [
        actions.choose([{ cond: _ => withMailbox,
          actions: Mailbox.Actions.reply('TASK_RECEIVED'),
        }]),
        _ => console.info('TASK_RECEIVED'),
      ],
      after: {
        10: 'idle',
      },
    },
  },
})

/**
 * Normal machine without Mailbox
 */
const machine = demoMachine(false)

/**
 * machine with Mailbox (async queue protocol support)
 */
const actor = Mailbox.from(demoMachine(true))

/**
 * send two events to the machine
 */
const testEvents = async (target: StateMachine<any, any, any>) => {
  const interpreter = interpret(target, { logger: () => {} })
    .start()

  Array(2).fill('TASK').forEach(e => {
    console.info('sending', e)
    interpreter.send(e)
  })
  await new Promise(resolve => setTimeout(resolve, 30))

  interpreter.stop()
}

/**
 * For normal machine, it will only response the first event
 */
console.info('# testing raw machine ...')
await testEvents(machine)
console.info('# testing raw machine ... done\n')

/**
 * for a Mailbox-ed machine, it will response all events by processing it one by one.
 */
console.info('# testing mailbox-ed machine ...')
await testEvents(actor)
console.info('# testing mailbox-ed machine ... done\n')

/**
 * Conclusion:
 *  a state machine has internal state transtions and it might not be able to response the new messages at a time,
 *  which means we need to have a mailbox to store the messages and process them one by one.
 *
 * This is the reason of why we built the Mailbox for XState for using it as a Actor Model with distributed async tasks.
 */
