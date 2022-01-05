import type { InterpreterOptions } from 'xstate'

interface MailboxOptions {
  id?       : string
  capacity? : number
  logger?   : InterpreterOptions['logger'],
}

const CHILD_MACHINE_ID = 'mailbox-address-child-machind-id'
const MAILBOX_NAME     = 'Mailbox'

export {
  type MailboxOptions,
  CHILD_MACHINE_ID,
  MAILBOX_NAME,
}
