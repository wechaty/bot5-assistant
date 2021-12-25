/* eslint-disable sort-keys */
import assert from 'assert'
import {
  StateMachine,
  createMachine,
  interpret,
  AnyEventObject,
  Interpreter,
}                   from 'xstate'

import * as Mailbox from './mod.js'

/**
 * Make the machine the child of the container to ready for testing
 *  because the machine need to use `sendParent` to send events to parent
 */
function container (machine: StateMachine<any, any, any>) {
  const CHILD_ID = 'mailbox-address-validating-child-id'
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
 * Initialization with RECEIVE event
 *
 * A mailbox-addressable machine MUST send parent RECEIVE right after it has been initialized
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
    Mailbox.Types.RECEIVE,
  ]
  // console.info(eventList)
  const actualInitEvents = eventList
    .map(e => e.type)
    .filter(type => EXPECTED_INIT_EVENT_TYPES.includes(type))

  /**
   * A mailbox-addressable machine MUST send parent RECEIVE right after it has been initialized
   */
  assert.deepEqual(actualInitEvents, EXPECTED_INIT_EVENT_TYPES, 'should send parent RECEIVE right after it has been initialized')

  return [interpreter, eventList] as const
}

/**
 * Response each event with RECEIVE event
 *  one event will get one RECEIVE event back
 */
function validateReceiveFormOtherEvent (
  interpreter: Interpreter<any>,
  eventList: AnyEventObject[],
): void {
  eventList.length = 0
  interpreter.send(String(Math.random()))

  console.info('eventList:', eventList)

  const actualIdleEvents = eventList
    .map(e => e.type)
    .filter(t => t === Mailbox.Types.RECEIVE)
  const EXPECTED_RECEIVE_EVENTS = [Mailbox.Types.RECEIVE]
  assert.deepEqual(
    actualIdleEvents,
    EXPECTED_RECEIVE_EVENTS,
    'Mailbox need the child machine to respond RECEIVE event to parent immediately whenever it has received one other event',
  )
}

/**
 * Response each event with RECEIVE event
 *  ten events will get ten RECEIVE events back
 */
function validateReceiveFormOtherEvents (
  interpreter: Interpreter<any>,
  eventList: AnyEventObject[],
): void {
  const TOTAL_EVENT_NUM = 10
  eventList.length = 0
  const randomEvents = [...Array(TOTAL_EVENT_NUM).keys()]
    .map(i => String(
      i + Math.random(),
    ))
  const EXPECTED_RECEIVE_EVENTS = Array
    .from({ length: TOTAL_EVENT_NUM })
    .fill(Mailbox.Types.RECEIVE)
  interpreter.send(randomEvents)
  const actualIdelEvents = eventList
    .map(e => e.type)
    .filter(t => t === Mailbox.Types.RECEIVE)
  assert.deepEqual(actualIdelEvents, EXPECTED_RECEIVE_EVENTS, `should send ${TOTAL_EVENT_NUM} RECEIVE events to parent when it has finished process ${TOTAL_EVENT_NUM} of other events`)
}

/**
 * Mailbox.Events.* is only for Mailbox system.
 *  They should not be sent to child machine.
 */
function validateSkipMailboxEvents (
  interpreter: Interpreter<any>,
  eventList: AnyEventObject[],
): void {
  const mailboxEventList = Object
    .values(Mailbox.Events)
    .map(e => e())

  mailboxEventList.forEach(mailboxEvent => {
    eventList.length = 0
    interpreter.send(mailboxEvent)
    const actualEvents = eventList.filter(e => e.type !== mailboxEvent.type)
    assert.deepEqual(actualEvents, [], `should skip ${mailboxEvent.type} event`)
  })
}

/**
 * Validate a state machine for satisfying the Mailbox address protocol:
 *  1. skip all EVENTs send from mailbox itself (Mailbox.Types.*)
 *  2. send parent `Mailbox.Events.RECEIVE()` event after each received events and back to the idle state
 *
 * @returns
 *  Success: will return true
 *  Failure: will throw an error
 */
function validate (
  machine: StateMachine<any, any, any>,
): boolean {
  /**
   * invoke the machine within a parent machine
   */
  const parentMachine = container(machine)

  /**
   * validate the machine initializing events
   */
  const [interpreter, eventList] = validateInitializing(parentMachine)

  /**
   * Response each event with RECEIVE event
   *
   * a mailbox-addressable machine MUST send RECEIVE event to parent when it has finished process an event
   *  (or the mailbox will stop sending any new events to it because it stays in busy state)
   */
  validateReceiveFormOtherEvent(interpreter, eventList)
  /**
   * Multiple events will get multiple RECEIVE event back
   */
  validateReceiveFormOtherEvents(interpreter, eventList)

  /**
   * child machine should not reply any Mailbox.Events.* events
   */
  validateSkipMailboxEvents(interpreter, eventList)

  interpreter.stop()

  return true
}

export {
  validate,
}
