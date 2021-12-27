const CHILD_MACHINE_ID = 'mailbox-address-child-machind-id'

enum Types {
  CHILD_BUSY = 'mailbox/CHILD_BUSY',
  CHILD_IDLE = 'mailbox/CHILD_IDLE',

  NEW_MESSAGE = 'mailbox/NEW_MESSAGE',
  DISPATCH    = 'mailbox/DISPATCH',
  DEAD_LETTER = 'mailbox/DEAD_LETTER',
  RESET       = 'mailbox/RESET',
}

/**
 * The default mailbox consists of two queues of messages: system messages and user messages.
 *
 * The system messages are used internally by the Actor Context to suspend and resume mailbox processing in case of failure.
 *  System messages are also used by internally to manage the Actor,
 *  e.g. starting, stopping and restarting it.
 *
 * User messages are sent to the actual Actor.
 *
 * @link https://proto.actor/docs/mailboxes/
 */
const isMailboxType = (type?: null | string): boolean => Object.values<string>(Types).includes(type || '')

export {
  Types,
  isMailboxType,
  CHILD_MACHINE_ID,
}
