import { registerMachine } from './register-machine.js'
import { mentionMachine } from './mention-machine.js'
import { feedbackActor } from './feedback-actor.js'
import { wechatyActor } from './wechaty-actor.js'

const feedback = {
  actor: feedbackActor,
  id: 'feedback',
}

const register = {
  actor: registerMachine,
  id: 'register',
}

const wechaty = {
  actor: wechatyActor,
  id: 'wechaty',
}

export {
  register,
  feedback,
  wechaty,
}
