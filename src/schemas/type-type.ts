import type * as types from './types.js'

export type Type = typeof types[keyof typeof types]
