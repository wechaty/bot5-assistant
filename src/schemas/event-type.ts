import type * as events from './events.js'

export type Event = ReturnType<typeof events[keyof typeof events]>
