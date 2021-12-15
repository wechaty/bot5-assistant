
/**
 * Dispatch v.s. Deliver
 *  - dispatch: internally preparation
 *  - deliver: externally shipping
 *
 *  @see https://tshirtfoundry.zendesk.com/hc/en-gb/articles/200668566-What-s-the-difference-between-dispatch-and-delivery-
 */
const dispatching   = 'mailbox/dispatching'
const delivering = 'mailbox/dilivering'

const idle = 'mailbox/idle'
const busy = 'mailbox/busy'

const resetting  = 'mailbox/resetting'
const spawning = 'mailbox/spawning'
const waiting = 'mailbox/waiting'

export {
  waiting,

  dispatching,
  delivering,

  idle,
  busy,

  resetting,
  spawning,
}
