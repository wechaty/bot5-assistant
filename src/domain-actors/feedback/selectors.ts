import type { Context } from './duckula.js'

export const contactNum   = (ctx: Context) => Object.keys(ctx.contacts).length
export const feedbackNum  = (ctx: Context) => Object.values(ctx.feedbacks).filter(Boolean).length
export const nextContact  = (ctx: Context) => Object.values(ctx.contacts).filter(c =>
  !Object.keys(ctx.feedbacks).includes(c.id),
)[0]
export const contactAfterNext   = (ctx: Context) => Object.values(ctx.contacts).filter(c =>
  !Object.keys(ctx.feedbacks).includes(c.id),
)[1]
