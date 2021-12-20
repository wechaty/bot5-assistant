/**
 * Finite State Machine for BOT Friday Club Meeting
 *  @link https://github.com/wechaty/bot5-assistant
 */
import type { MachineConfig, StateSchema } from 'xstate'
import type { Wechaty } from 'wechaty'

import * as events from './events.js'
import * as states from './states.js'

type States = typeof states[keyof typeof states]
type Events = typeof events[keyof typeof events]

interface MeetingEventSchema {
  type: Events
}

interface MeetingActionSchema {
  type: never
}

interface MeetingContext {
  wechaty: Wechaty,
}

interface MeetingStateSchema {
  states: {
    [key in States]:  StateSchema<any>
  }
  value: States // types for `state.matches<T>()`
  context: MeetingContext
}

const statesX = {
  [states.idle]: {
    on: {
      [events.START]: states.meeting,
    },
  },
  [states.meeting]: {
    on: {
      [events.CANCEL]: states.idle,
      [events.FINISH]: states.idle,
    },
  },
} as const

const config: (wechaty: Wechaty) => MachineConfig<
  MeetingContext,
  MeetingStateSchema,
  MeetingEventSchema
> = wechaty => ({
  context: {
    wechaty,
  },
  id: 'meeting-machine',
  initial: states.idle,
  states: statesX,
} as const)

export type {
  MeetingActionSchema,
  MeetingContext,
  MeetingEventSchema,
  MeetingStateSchema,
}
export { config }
