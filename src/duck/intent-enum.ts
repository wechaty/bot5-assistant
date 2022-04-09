/* eslint-disable no-redeclare */
import * as intents from './intents.js'

export type Intent = typeof intents[keyof typeof intents]
export const Intent = intents
