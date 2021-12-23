enum States {
  /**
   * Idle Time – Definition, Causes, And How To Reduce It
   *  @see https://limblecmms.com/blog/idle-time/
   */
  idle = 'mailbox/idle',
  busy = 'mailbox/busy',

  /**
   * Dispatch v.s. Deliver
   *  - dispatch: internally preparation
   *  - deliver: externally shipping
   *
   *  @see https://tshirtfoundry.zendesk.com/hc/en-gb/articles/200668566-What-s-the-difference-between-dispatch-and-delivery-
   */
  dispatching = 'mailbox/dispatching',
  delivering  = 'mailbox/dilivering',

  responding = 'mailbox/responding',

  resetting = 'mailbox/resetting',
  spawning  = 'mailbox/spawning',

  incoming = 'mailbox/incoming',
  outgoing = 'mailbox/outgoing',
  routing = 'mailbox/routing',

  // Dead Letter
  deadLetter = 'mailbox/deadLetter',
}

export {
  States,
}
