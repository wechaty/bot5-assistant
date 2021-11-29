/**
 * Finite State Machine for BOT Friday Club Meeting
 *  @link https://github.com/wechaty/bot5-assistant
 */
import type { MachineConfig, StateSchema } from 'xstate'
import type { Wechaty } from 'wechaty'

import * as events from './events.js'
import * as states from './states.js'

interface MeetingEventSchema {
  type: keyof typeof events
}

interface MeetingActionSchema {
  type: never
}

interface MeetingContext {
  wechaty: Wechaty,
}

interface MeetingStateSchema {
  states: {
    [key in keyof typeof states]:  StateSchema<any>
  }
  value: keyof typeof states // types for `state.matches<T>()`
  context: MeetingContext
}

const idle = {
  on: {
    START: 'meeting',
  },
} as const

const meeting = {
  on: {
    CANCEL : 'idle',
    FINISH  : 'idle',
  },
} as const

const states = {
  idle,
  meeting,
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
  initial: 'idle',
  states,
} as const)

export type {
  MeetingActionSchema,
  MeetingContext,
  MeetingEventSchema,
  MeetingStateSchema,
}
export { config }
