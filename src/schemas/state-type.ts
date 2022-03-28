import type * as states from './states.js'

export type State = typeof states[keyof typeof states]
