import {
  actions,
  AnyEventObject,
  Action,
  Event,
  SCXML,
  EventObject,
  AssignMeta,
}                       from 'xstate'
import type {
  DeepReadonly,
}                     from 'utility-types'

import { events } from '../schemas/mod.js'

/**
 *
 * Huan(202112): The Actor Model here need to be improved.
 *  @see https://github.com/wechaty/bot5-assistant/issues/4
 *
 */
 type AnyEventObjectExt = AnyEventObject & {
  meta: {
    origin: SCXML.Event<AnyEventObject>['origin']
  }
}

interface Mailbox {
  current:  null | AnyEventObjectExt
  queue:    AnyEventObjectExt[]
}

interface Context {
  mailbox: Mailbox
}

const context: Context = {
  mailbox: {
    current: null,
    queue: [],
  } as Readonly<Mailbox>,
}

const enqueue = actions.assign<Context>({
  mailbox: (ctx, e, { _event }) => {
    // console.info('[wechaty-actor] [event]', _event)
    const mailbox = {
      ...ctx.mailbox,
      queue: [
        ...ctx.mailbox.queue,
        {
          ...e,
          meta: {
            origin: _event.origin,
          },
        },
      ],
    }
    return mailbox
  },
}) as any

const dequeue = actions.assign<Context>({
  mailbox: ctx => {
    const current = ctx.mailbox.queue.shift()

    console.info('dequeue: current is', current?.type)
    console.info('dequeue: left queue length', ctx.mailbox.queue.length)

    if (!current) {
      return ctx.mailbox
    }

    const mailbox: Context['mailbox'] = {
      ...ctx.mailbox,
      current,
    }
    return mailbox
  },
}) as any

const nonempty = (ctx: Context) => {
  const result = ctx.mailbox.queue.length > 0
  console.info('nonempty:' + result)
  return result
}

const respond = (event: EventObject) => actions.send(
  event,
  {
    to: (ctx: Context) => {
      // console.info('wechatyActor: aborting events:', ctx.events)
      // console.info('wechatyActor: aborting currentEvent:', ctx.currentEvent)
      /**
       * FIXME: Huan(202112): any better way to do this?
       */
      return ctx.mailbox.current?.meta.origin as any
    },
  },
)

const current = (ctx: Context) => ctx.mailbox.current

/**
 * Huan(202112): we must use `actions.assign` to assign the value of `ctx.mailbox.current`
 *  or the context will not be set correctly.
 *
 * Details:
 *  the `actions.assign` will be guarenteed to be called before each transition.
 *  other actions will be called after each transition. (something like that)
 */
const setCurrent = actions.assign((ctx: Context, e: EventObject, meta: AssignMeta<Context, any>) => {
  console.info('setCurrent:', e.type)
  ctx.mailbox.current = {
    ...e,
    meta: {
      origin: meta._event.origin,
    },
  }
  return {}
}) as any

export {
  type Context,
  context,
  enqueue,
  dequeue,
  nonempty,
  respond,
  current,
  setCurrent,
}
