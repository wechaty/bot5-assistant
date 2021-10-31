import {
  createMachine,
  interpret,
}                       from 'xstate'
import type { Wechaty } from 'wechaty'

import {
  MeetingContext,
  MeetingEventSchema,
  MeetingStateSchema,
  config,
}                           from './machine-config.js'

const getInterpreter = (wechaty: Wechaty) => {
  const machine = createMachine<
    MeetingContext,
    MeetingEventSchema,
    MeetingStateSchema
  >(config(wechaty))

  const interpreter = interpret(machine)
  interpreter.start()

  return interpreter
}

export { getInterpreter }
