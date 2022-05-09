import type * as PUPPET   from 'wechaty-puppet'

export interface Talk {
  speaker  : PUPPET.payloads.Contact
  bio      : string
  title    : string
  abstract : string
}
