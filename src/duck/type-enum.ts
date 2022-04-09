/* eslint-disable no-redeclare */
import * as types from './types.js'

export type Type = typeof types[keyof typeof types]
export const Type = types
