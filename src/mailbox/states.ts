enum States {
  /**
   * Idle Time – Definition, Causes, And How To Reduce It
   *  @see https://limblecmms.com/blog/idle-time/
   *
   * Note: idle & busy are only for Async mode.
   *  non-async mode should use listening/standby (see below)
   */
  idle = 'mailbox/idle',
  busy = 'mailbox/busy',

  /**
   * Non-async mode should use listening/standby
   */
  listening = 'mailbox/listening',
  standby   = 'mailbox/standby',

  /**
   * Dispatch v.s. Deliver
   *  - dispatch: internally preparation
   *  - deliver: externally shipping
   *
   *  @see https://tshirtfoundry.zendesk.com/hc/en-gb/articles/200668566-What-s-the-difference-between-dispatch-and-delivery-
   */
  dispatching = 'mailbox/dispatching',
  delivering  = 'mailbox/dilivering',
  dequeuing   = 'mailbox/dequeuing',
  checking = 'mailbox/checking',

  responding = 'mailbox/responding',

  resetting = 'mailbox/resetting',
  spawning  = 'mailbox/spawning',

  incoming = 'mailbox/incoming',
  outgoing = 'mailbox/outgoing',
  routing  = 'mailbox/routing',
}

export {
  States,
}
