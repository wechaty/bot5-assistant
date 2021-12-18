/* eslint-disable sort-keys */
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

const metaSymKey = Symbol('meta')

/**
 *
 * Huan(202112): The Actor Model here need to be improved.
 *  @see https://github.com/wechaty/bot5-assistant/issues/4
 *
 */
 type AnyEventObjectExt = AnyEventObject & {
  [metaSymKey]: {
    origin: SCXML.Event<AnyEventObject>['origin']
  }
}

interface Context {
  /**
   * event: every state machine event
   * message: event is neither sent from mailbox nor child (external evetns, which should be proxyed to the child)
   */
  currentEvent   : null | AnyEventObjectExt
  currentMessage : null | AnyEventObjectExt
  /**
   * actor module: one message one time
   *  a message will only start to be processed(submitted to the child) when the child has transited to the IDLE state
   */
  messageQueue: AnyEventObjectExt[]
  /**
   * The child actor
   */
  childRef : null | ActorRef<any>
  nullRef  : null | ActorRef<any>
}

const condCurrentEventOriginIsChild = (ctx: Context) => {
  if (!ctx.currentEvent) {
    return false
  }
  // Huan(202112): TODO: remove any
  if (!ctx.childRef || !(ctx.childRef as any).sessionId) {
    return false
  }

  return ctx.currentEvent[metaSymKey].origin === (ctx.childRef as any).sessionId
}

const assignEnqueueMessage = actions.assign<Context>({
  messageQueue: ctx => [
    ...ctx.messageQueue,
    ctx.currentEvent!,
  ],
}) as any

const assignDequeueMessage = actions.assign<Context>({
  currentMessage: ctx => ctx.messageQueue.shift()!,
}) as any

const assignCurrentEventNull = actions.assign<Context>({
  currentEvent: _ => null,
}) as any

const wrapEvent = (
  _: Context,
  e: EventObject,
  { _event }: {
    _event: SCXML.Event<AnyEventObject>,
  },
) => ({
  ...e,
  [metaSymKey]: {
    origin: _event.origin,
  },
})

const unwrapEvent = (e: AnyEventObjectExt): AnyEventObject => {
  const event = {
    ...e,
  }
  delete (event as any)[metaSymKey]
  return event
}

const assignCurrentEvent = actions.assign<Context>({
  currentEvent: wrapEvent,
}) as any

const condMessageQueueNonempty = (ctx: Context) => {
  console.info('condMessageQueueNonempty', ctx.messageQueue.length)
  return ctx.messageQueue.length > 0
}

const getOrigin = (ctx: Context) => {
  console.info('### getOrigin:', JSON.stringify(ctx.currentMessage))
  return (ctx.currentMessage && ctx.currentMessage[metaSymKey].origin) || undefined
}
const hasOrigin = (ctx: Context) => !!getOrigin(ctx)

/**
 * Send the `currentEvent` as the repond to `currentMessage`
 */
const respond = actions.choose([
  /**
   * 1. if has current message & origin, respond to the origin
   */
  {
    cond: hasOrigin,
    actions: [
      actions.log<Context, EventObject>(ctx => '#### responsd: origin found, send to origin: ' + getOrigin(ctx)),
      actions.send<Context, EventObject>(
        ctx => {
          console.info('HUAN respond before:', ctx.currentEvent)
          const e = unwrapEvent(ctx.currentEvent!)
          console.info('HUAN respond after:', e)
          return e
        },
        {
          to: ctx => getOrigin(ctx)!,
        },
      ),
    ],
  },
  /**
   * 2. else send to null (drop)
   */
  {
    actions: [
      actions.log<Context, EventObject>(ctx => 'contexts.responsd drop message: ' + JSON.stringify(ctx.currentEvent), 'Mailbox'),
    ],
  },
])

/**
 * use JSON.parse() to prevent the initial context from being changed
 */
const initialContext: () => Context = () => {
  const context: Context = {
    childRef       : null,
    currentEvent   : null,
    currentMessage : null,
    messageQueue   : [],
    nullRef        : null,
  }
  return JSON.parse(
    JSON.stringify(
      context,
    ),
  )
}

const sendCurrentMessageToChild = actions.send<Context, any>(
  ctx => {
    console.info('sendCurrentMessageToChild:', JSON.stringify(ctx.currentMessage))
    return ctx.currentMessage!
  },
  {
    to: ctx => ctx.childRef!,
  },
) as any

export {
  type Context,
  metaSymKey,
  initialContext,
  assignDequeueMessage,
  assignEnqueueMessage,
  assignCurrentEvent,
  assignCurrentEventNull,
  condCurrentEventOriginIsChild,
  condMessageQueueNonempty,
  respond,
  sendCurrentMessageToChild,
}
