import type { InterpreterOptions } from 'xstate'

interface MailboxOptions {
  id?       : string
  capacity? : number
  logger?   : InterpreterOptions['logger'],
}

const MAILBOX_TARGET_MACHINE_ID = 'mailbox-target-machind-id'

const MAILBOX_NAME = 'Mailbox'

export {
  type MailboxOptions,
  MAILBOX_TARGET_MACHINE_ID,
  MAILBOX_NAME,
}
