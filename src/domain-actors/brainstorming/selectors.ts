import { removeUndefined }    from '../../pure-functions/remove-undefined.js'

import type { Context }   from './duckula.js'

export const feedbacksNum = (ctx: Context) => Object.values(ctx.feedbacks)
  .filter(removeUndefined)
  .length

export const contactsNum  = (ctx: Context) => Object.keys(ctx.contacts)
  .length
