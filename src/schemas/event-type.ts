import type * as events from './events.js'

export type Event = typeof events[keyof typeof events]
