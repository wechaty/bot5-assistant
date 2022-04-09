import * as states from './states.js'

export const State = states
// eslint-disable-next-line no-redeclare
export type State = typeof State[keyof typeof State]
