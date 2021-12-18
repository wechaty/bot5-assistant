enum States {
  /**
   * Dispatch v.s. Deliver
   *  - dispatch: internally preparation
   *  - deliver: externally shipping
   *
   *  @see https://tshirtfoundry.zendesk.com/hc/en-gb/articles/200668566-What-s-the-difference-between-dispatch-and-delivery-
   */
  dispatching = 'mailbox/dispatching',
  delivering  = 'mailbox/dilivering',

  idle       = 'mailbox/idle',
  busy       = 'mailbox/busy',
  responding = 'mailbox/responding',

  resetting = 'mailbox/resetting',
  spawning  = 'mailbox/spawning',

  incoming = 'mailbox/incoming',
  outgoing = 'mailbox/outgoing',
  routing = 'mailbox/routing',
}

export {
  States,
}
