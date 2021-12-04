/**
 * Finite State Machine for BOT Friday Club Meeting
 *  @link https://github.com/wechaty/bot5-assistant
 */
import type { MachineConfig, StateSchema } from 'xstate'
import type { Wechaty } from 'wechaty'

type MeetingEvent =
  | 'START'
  | 'FINISH'
  | 'CANCEL'
  | 'YES'
  | 'NO'
  | 'NEXT'
  | 'TALK'

type MeetingState =
  | 'meeting'
  | 'idle'

interface MeetingEventSchema {
  type: MeetingEvent
}

interface MeetingActionSchema {
  type: never
}

interface MeetingContext {
  wechaty: Wechaty,
}

interface MeetingStateSchema {
  states: {
    [key in MeetingState]:  StateSchema<any>
  }
  value: MeetingState // types for `state.matches<T>()`
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
  MeetingState,
}
export { config }
