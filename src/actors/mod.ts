import { registerMachine } from './register-actor.js'
import { mentionMachine } from './mention-machine.js'
import { feedbackMachine } from './feedback-actor.js'
import { wechatyActor } from './wechaty-actor.js'

const feedback = {
  actor: feedbackMachine,
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
