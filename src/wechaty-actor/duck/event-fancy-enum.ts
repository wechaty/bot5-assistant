import * as events from './events.js'

/**
 * Huan(202204): We are using a "Fancy Enum" instead of a TypeScript native `enum` at here,
 *  because the below tweet from @BenLesh said:
 *
 *  @link https://twitter.com/huan_us/status/1511260462544998404
 */

export const Event = events
// eslint-disable-next-line no-redeclare
export type Event = {
  [key in keyof typeof Event]: ReturnType<typeof Event[key]>
}
