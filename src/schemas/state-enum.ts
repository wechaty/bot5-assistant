/* eslint-disable no-redeclare */
import * as states from './states.js'

export type State = typeof states[keyof typeof states]
export const State = states
