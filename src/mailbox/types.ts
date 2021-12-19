enum Types {
  BUSY     = 'mailbox/BUSY',
  DISPATCH = 'mailbox/DISPATCH',
  IDLE     = 'mailbox/IDLE',
  NOTIFY   = 'mailbox/NOTIFY',
  RESET    = 'mailbox/RESET',
}

const isMailboxType = (type?: null | string): boolean => Object.values<string>(Types).includes(type || '')

export {
  Types,
  isMailboxType,
}
