import type {
  EventObject,
  StateMachine,
}               from 'xstate'

import {
  MailboxImpl,
  Interface,
}               from './mailbox.js'
import { wrap } from './wrap.js'
import type { Options } from './options.js'

/**
 * Create a Mailbox for the target machine
 *
 * @param targetMachine the target machine that conform to the Mailbox Actor Message Queue API
 */
function from<
  TContext extends {},
  TEvent extends EventObject,
> (
  targetMachine: StateMachine<
    TContext,
    any,
    TEvent
  >,
  options?: Options,
): Interface<TEvent> {
  const wrappedMachine = wrap(targetMachine, options)
  return new MailboxImpl(targetMachine, wrappedMachine, options)
}

export {
  from,
}
