import {
  createMachine,
}                   from 'xstate'

import { from } from './from.js'
import type { Options } from './options.js'

/**
 * Null destinations for Machine, Mailbox, Address, and Logger
 */
const machine = createMachine<{}>({})
const mailbox = from(machine)
mailbox.acquire()

const address = mailbox.address

const logger: Options['logger'] = () => {}

export {
  mailbox,
  machine,
  address,
  logger,
}
