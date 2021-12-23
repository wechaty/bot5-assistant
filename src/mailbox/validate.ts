/* eslint-disable sort-keys */
import assert from 'assert'
import {
  StateMachine,
  createMachine,
  interpret,
  AnyEventObject,
  Interpreter,
}                   from 'xstate'

import { IS_DEVELOPMENT } from './config.js'

import * as Mailbox from './mod.js'

/**
 * Initialization with IDLE event
 *
 * A mailbox-addressable machine MUST send parent IDLE right after it has been initialized
 *  (or the mailbox can not know when the machine is ready to process events)
 *
 */
function validateInitializing (
  machine: StateMachine<any, any, any>,
) {
  const eventList: AnyEventObject[] = []
  const interpreter = interpret(machine)
    .onEvent(e => eventList.push(e))
    .start()

  const EXPECTED_INIT_EVENT_TYPES = [
    'xstate.init',
    Mailbox.Types.IDLE,
  ]
  const actualInitEvents = eventList
    .map(e => e.type)
    .filter(type => EXPECTED_INIT_EVENT_TYPES.includes(type))
  assert.deepEqual(actualInitEvents, EXPECTED_INIT_EVENT_TYPES, 'should send parent IDLE right after it has been initialized')

  return [interpreter, eventList] as const
}

/**
 * Response each event with IDLE event
 *  one event will get one IDLE event back
 */
function validateIdleForOneUnknownEvent (
  interpreter: Interpreter<any>,
  eventList: AnyEventObject[],
): void {
  eventList.length = 0
  interpreter.send(String(Math.random()))

  // console.info('eventList:', eventList)

  const actualIdleEvents = eventList
    .map(e => e.type)
    .filter(t => t === Mailbox.Types.IDLE)
  const EXPECTED_IDLE_EVENTS = [Mailbox.Types.IDLE]
  assert.deepEqual(
    actualIdleEvents,
    EXPECTED_IDLE_EVENTS,
    'Mailbox need the child machine to respond IDLE event to parent immediately whenever it has received an unknown event',
  )
}

/**
 * Response each event with IDLE event
 *  ten events will get ten IDLE events back
 */
function validateIdleForTenUnknownEvent (
  interpreter: Interpreter<any>,
  eventList: AnyEventObject[],
): void {
  const TOTAL_EVENT_NUM = 10
  eventList.length = 0
  const randomEvents = [...Array(TOTAL_EVENT_NUM).keys()]
    .map(i => String(
      i + Math.random(),
    ))
  const EXPECTED_IDLE_EVENTS = Array
    .from({ length: TOTAL_EVENT_NUM })
    .fill(Mailbox.Types.IDLE)
  interpreter.send(randomEvents)
  const actualIdelEvents = eventList
    .map(e => e.type)
    .filter(t => t === Mailbox.Types.IDLE)
  assert.deepEqual(actualIdelEvents, EXPECTED_IDLE_EVENTS, `should send ${TOTAL_EVENT_NUM} IDLE events to parent when it has finished process ${TOTAL_EVENT_NUM} events`)
}

/**
 *
 * Response each event with IDLE event
 *
 * a mailbox-addressable machine MUST send IDLE event to parent when it has finished process an event
 *  (or the mailbox will stop sending any new events to it because it stays in busy state)
 *
 */
function validateIdle (
  interpreter: Interpreter<any>,
  eventList: AnyEventObject[],
): void {
  validateIdleForOneUnknownEvent(interpreter, eventList)
  validateIdleForTenUnknownEvent(interpreter, eventList)
}

function container (machine: StateMachine<any, any, any>) {
  const CHILD_ID = 'child-id'
  const parentMachine = createMachine({
    invoke: {
      id: CHILD_ID,
      src: machine,
    },
    initial: 'testing',
    states: {
      testing: {
        on: {
          '*': { actions: Mailbox.Actions.sendChildProxy(CHILD_ID) },
        },
      },
    },
  })
  return parentMachine
}

/**
 * Mailbox.Events.* is only for Mailbox system.
 *  They should not be sent to child machine.
 */
function validateSkipMailboxEvents (
  interpreter: Interpreter<any>,
  eventList: AnyEventObject[],
): void {
  const skipEvents = [
    Mailbox.Events.IDLE(),
    Mailbox.Events.BUSY(),
    Mailbox.Events.DISPATCH(),
    Mailbox.Events.NOTIFY(),
    Mailbox.Events.RESET(),
  ]
  skipEvents.forEach(skipEvent => {
    eventList.length = 0
    interpreter.send(skipEvent)
    const actualEvents = eventList.filter(e => e.type !== skipEvent.type)
    assert.deepEqual(actualEvents, [], `should skip ${skipEvent.type} event`)
  })
}

/**
 * Validate a machine for satisfying the Mailbox address protocol:
 *  1. skip all EVENTs send from mailbox itself
 *  2. send parent `Mailbox.Events.IDLE()` event after each received events and back to the idle state
 *
 * Success: will return true
 * Failure: will throw an error
 */
function validate (machine: StateMachine<any, any, any>): boolean {
  if (!IS_DEVELOPMENT) {
    return true
  }

  try {
    /**
     * invoke the machine within a parent machine
     */
    const parentMachine = container(machine)

    /**
     * validate the machine initializing events
     */
    const [interpreter, eventList] = validateInitializing(parentMachine)

    /**
     * validate the machine idle events
     */
    validateIdle(interpreter, eventList)

    /**
     * child machine should not reply any Mailbox.Events.* events
     */
    validateSkipMailboxEvents(interpreter, eventList)

    interpreter.stop()

    return true
  } catch (e) {
    console.error(e)
    return false
  }
}

export {
  validate,
}
