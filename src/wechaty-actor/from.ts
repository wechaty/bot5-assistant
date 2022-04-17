import type * as CQRS   from 'wechaty-cqrs'
import * as Mailbox     from 'mailbox'

import machine from './machine.js'

const from = (
  bus$      : CQRS.Bus,
  puppetId? : string,
) => {
  const mailbox = Mailbox.from(
    machine.withContext({
      bus$,
      puppetId,
    }),
  )
  mailbox.open()
  return mailbox
}

export default from
