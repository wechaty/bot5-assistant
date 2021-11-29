import * as events from './events.js'

const idle = {
  on: {
    [events.START]: 'meeting',
  },
} as const

const meeting = {
  on: {
    [events.CANCEL] : 'idle',
    [events.FINISH] : 'idle',
  },
} as const

export {
  meeting,
  idle,
}
