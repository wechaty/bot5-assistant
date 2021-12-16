/**
 * XState Actors:
 *  @see https://xstate.js.org/docs/guides/actors.html#actor-api
 */

import {
  actions,
  AnyEventObject,
  SCXML,
  EventObject,
  ActorRef,
}                       from 'xstate'

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

interface Context {
  childRef : null | ActorRef<any>
  current  : null | AnyEventObjectExt
  queue    : AnyEventObjectExt[]
}

const condChildEvent = (ctx: Context, _: any, { _event }: any) => {
  if (!_event.origin) {
    return false
  }
  if (!ctx.childRef || !(ctx.childRef as any).sessionId) {
    return false
  }

  return _event.origin === (ctx.childRef as any).sessionId
}

const assignEnqueue = actions.assign<Context>({
  queue: (ctx, e, { _event }) => {
    if (condChildEvent(ctx, e, { _event })) {
      console.info('Mailbox context.assignEnqueue skip child event:', _event)
      return ctx.queue
    }

    console.info('Mailbox context.assignEnqueue _event:', _event)
    return [
      ...ctx.queue,
      {
        ...e,
        meta: {
          origin: _event.origin,
        },
      },
    ]
  },
}) as any

const assignDequeue = actions.assign<Context>({
  current: ctx => {
    console.info('[dequeue] length:', ctx.queue.length)

    if (ctx.queue.length <= 0) {
      return null
    }

    const current = ctx.queue.shift()
    console.info('[dequeue] current:', current?.type)

    if (!current) {
      return null
    }

    return current
  },
}) as any

const condNonempty = (ctx: Context) => {
  const result = ctx.queue.length > 0
  console.info('[nonempty]:' + result)
  return result
}

const respond = (event: EventObject) => actions.send(
  event,
  {
    to: (ctx: Context) => {
      // console.info('respond: aborting events:', ctx.events)
      // console.info('respond: aborting currentEvent:', ctx.currentEvent)
      /**
       * FIXME: Huan(202112): any better way to do this?
       */
      return ctx.current?.meta.origin as any
    },
  },
)

/**
 * use JSON.parse() to prevent the initial context from being changed
 */
const initialContext: () => Context = () => {
  const context: Context = {
    childRef : null,
    current  : null,
    queue    : [],
  }
  return JSON.parse(
    JSON.stringify(
      context,
    ),
  )
}

export {
  type Context,
  initialContext,
  assignEnqueue,
  assignDequeue,
  condNonempty,
  condChildEvent,
  respond,
}
