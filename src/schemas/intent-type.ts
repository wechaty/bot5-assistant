import type * as intents from './intents.js'

export type Intent = typeof intents[keyof typeof intents]
