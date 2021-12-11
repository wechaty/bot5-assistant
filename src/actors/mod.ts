import { wechatyMachine } from './wechaty-machine.js'
import { registerMachine } from './register-machine.js'
import { mentionMachine } from './mention-machine.js'
import { feedbackMachine } from './feedback-machine.js'
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
