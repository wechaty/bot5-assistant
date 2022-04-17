/* eslint-disable no-redeclare */
import * as events from './events.js'

/**
 * Huan(202204): We are using a "Fancy Enum" instead of a TypeScript native `enum` at here,
 *  because the below tweet from @BenLesh said:
 *
 *  @link https://twitter.com/huan_us/status/1511260462544998404
 */

export type Event = {
  [K in keyof typeof events]: ReturnType<typeof events[K]>
}
// eslint-disable-next-line @typescript-eslint/no-redeclare
export const Event = events
