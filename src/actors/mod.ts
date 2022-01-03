import * as Mailbox from '../mailbox/mod.js'

import { registerMachine }  from './register-machine.js'
import { feedbackMachine }  from './feedback-machine.js'
import { wechatyMachine }   from './wechaty-machine.js'
import { intentMachine }    from './intent-machine.js'

const feedback = {
  actor: Mailbox.address(feedbackMachine),
  id: 'feedback',
} as const

const register = {
  actor: Mailbox.address(registerMachine),
  id: 'register',
} as const

const wechaty = {
  actor: Mailbox.address(wechatyMachine),
  id: 'wechaty',
} as const

const intent = {
  actor: Mailbox.address(intentMachine),
  id: 'intent',
} as const

export {
  register,
  feedback,
  wechaty,
  intent,
}
