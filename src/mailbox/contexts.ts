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

const meta = Symbol('meta')

/**
 *
 * Huan(202112): The Actor Model here need to be improved.
 *  @see https://github.com/wechaty/bot5-assistant/issues/4
 *
 */
 type AnyEventObjectExt = AnyEventObject & {
  [meta]: {
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
  nullRef : null | ActorRef<any>
}

const condCurrentEventFromChild = (ctx: Context) => {
  if (!ctx.currentEvent) {
    return false
  }
  // Huan(202112): TODO: remove any
  if (!ctx.childRef || !(ctx.childRef as any).sessionId) {
    return false
  }

  return ctx.currentEvent[meta].origin === (ctx.childRef as any).sessionId
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
  [meta]: {
    origin: _event.origin,
  },
})

const unwrapEvent = (e: AnyEventObjectExt): AnyEventObject => {
  const event = {
    ...e,
  }
  delete (event as any)[meta]
  return event
}

const assignCurrentEvent = actions.assign<Context>({
  currentEvent: wrapEvent,
}) as any

const condMessageQueueNonempty = (ctx: Context) => {
  console.info('condMessageQueueNonempty', ctx.messageQueue.length)
  return ctx.messageQueue.length > 0
}

/**
 * Send the `currentEvent` as the repond to `currentMessage`
 */
const respond = actions.send<Context, EventObject>(
  ctx => unwrapEvent(ctx.currentEvent!),
  {
    to: (ctx: Context) => {
      console.info('contexts.respond currentEvent:', ctx.currentEvent)

      const origin = ctx.currentMessage && ctx.currentMessage[meta].origin
      if (!origin) {
        /**
         * If there's no origin, it means that we do not know where to reponsd this message
         *  so send it to the null actor
         */
        return ctx.nullRef!
      }

      console.info('contexts.response to:', origin)
      return origin
    },
  },
)

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
  initialContext,
  assignDequeueMessage,
  assignEnqueueMessage,
  assignCurrentEvent,
  assignCurrentEventNull,
  condCurrentEventFromChild,
  condMessageQueueNonempty,
  respond,
  sendCurrentMessageToChild,
}
