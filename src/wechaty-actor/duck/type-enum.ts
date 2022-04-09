import * as types from './types.js'

export const Type = types
// eslint-disable-next-line no-redeclare
export type Type = typeof Type[keyof typeof Type]
