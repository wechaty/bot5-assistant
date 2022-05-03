/* eslint-disable no-redeclare */
import * as intents from './intents.js'

/**
 * Huan(202204): We are using a "Fancy Enum" instead of a TypeScript native `enum` at here,
 *  because the below tweet from @BenLesh said:
 *
 *  @link https://twitter.com/huan_us/status/1511260462544998404
 */

export type Intent = typeof intents[keyof typeof intents]
export const Intent = intents
