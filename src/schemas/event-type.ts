import type * as events from './events.js'

export type Event = ReturnType<typeof events[keyof typeof events]>
export type Events = {
  [K in keyof typeof events]: ReturnType<typeof events[K]>
}
