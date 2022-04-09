import * as events from './events.js'

export const Event = events
// eslint-disable-next-line no-redeclare
export type Event = {
  [key in keyof typeof Event]: ReturnType<typeof Event[key]>
}
