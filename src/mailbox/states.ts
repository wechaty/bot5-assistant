
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
const responding = 'mailbox/responding'

const resetting  = 'mailbox/resetting'
const spawning = 'mailbox/spawning'

const incoming = 'mailbox/incoming'
const outgoing = 'mailbox/outgoing'
const routing = 'mailbox/routing'

export {
  dispatching,
  delivering,

  idle,
  busy,
  responding,

  resetting,
  spawning,

  incoming,
  outgoing,
  routing,
}
