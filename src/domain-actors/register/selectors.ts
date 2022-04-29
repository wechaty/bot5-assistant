import type { Context } from './duckula.js'

export const contactNum = (ctx: Context) => Object.keys(ctx.contacts).length
