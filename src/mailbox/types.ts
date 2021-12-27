const CHILD_MACHINE_ID = 'mailbox-address-child-machind-id'

enum Types {
  /**
   * sub state types of: child
   */
  CHILD_IDLE = 'mailbox/CHILD_IDLE',

  /**
   * types of: debug
   */
  DEAD_LETTER = 'mailbox/DEAD_LETTER',
  RESET       = 'mailbox/RESET',

  /**
   * sub state types of: queue
   */
  ENQUEUE  = 'mailbox/ENQUEUE',
  DEQUEUE  = 'mailbox/DEQUEUE',
  DISPATCH = 'mailbox/DISPATCH',
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
const isMailboxType = (type?: null | string): boolean => !!type && Object.values<string>(Types).includes(type)

export {
  Types,
  isMailboxType,
  CHILD_MACHINE_ID,
}
