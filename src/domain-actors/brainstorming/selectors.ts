import type { Context } from './duckula.js'

export const feedbacksNum = (ctx: Context) => Object.values(ctx.feedbacks).filter(Boolean).length
export const contactsNum  = (ctx: Context) => Object.keys(ctx.contacts).length
