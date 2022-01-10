import type { InterpreterOptions } from 'xstate'

interface Options {
  id?       : string
  capacity? : number
  logger?   : InterpreterOptions['logger'],
  devTools? : InterpreterOptions['devTools'],
}

const MAILBOX_TARGET_MACHINE_ID = 'mailbox-target-machind-id'

const MAILBOX_NAME = 'Mailbox'

export {
  type Options,
  MAILBOX_TARGET_MACHINE_ID,
  MAILBOX_NAME,
}
