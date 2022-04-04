import type { ActionType } from 'typesafe-actions'
import type * as events from './events.js'

export type Events = typeof events
export type Event = ActionType<Events>
