import {
  type Mailbox,
  MailboxImpl,
}               from './mailbox.js'
import {
  type Address,
  AddressImpl,
}               from './address.js'
import { Actions } from './actions.js'
import { Events } from './events.js'
import { States } from './states.js'
import { Types } from './types.js'

import { validate }       from './validate.js'
import { wrap }           from './wrap.js'

const from: typeof MailboxImpl.from = (machine) =>
  MailboxImpl.from(machine)

export {
  type Address,
  type Mailbox,
  //
  from,
  MailboxImpl,
  AddressImpl,
  //
  Actions,
  Events,
  Types,
  States,
  //
  validate,
  wrap,
}
