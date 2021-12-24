enum Types {
  BUSY     = 'mailbox/BUSY',
  DISPATCH = 'mailbox/DISPATCH',
  IDLE     = 'mailbox/IDLE',
  NOTIFY   = 'mailbox/NOTIFY',
  RESET    = 'mailbox/RESET',

  RECEIVE     = 'mailbox/RECEIVE',
  DEAD_LETTER = 'mailbox/DEAD_LETTER',
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
}
