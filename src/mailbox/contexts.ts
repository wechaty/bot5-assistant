/* eslint-disable sort-keys */
/**
 * XState Actors:
 *  @see https://xstate.js.org/docs/guides/actors.html#actor-api
 */

import {
  actions,
  AnyEventObject,
  SCXML,
  ActorRef,
}                   from 'xstate'

import { Events } from './events.js'

const metaSymKey = Symbol('meta')

/**
 *
 * Huan(202112): The Actor Model here need to be improved.
 *  @see https://github.com/wechaty/bot5-assistant/issues/4
 *
 */
interface AnyEventObjectMeta {
  [metaSymKey]: {
    origin: SCXML.Event<AnyEventObject>['origin']
  }
}
type AnyEventObjectExt = AnyEventObject & AnyEventObjectMeta

interface Context {
  /**
   * every event that the state machine received will be stored in `event`
   */
  event: null | AnyEventObjectExt
  /**
   * A message is a event: (external evetns, which should be proxyed to the child)
   *  1. neither sent from mailbox
   *  2. nor from child
   */
  messages: AnyEventObjectExt[]
  /**
   * current message index: actor module must only process one message one time
   *  a message will only start to be processed(submitted to the child)
   *  when the child has transited to the IDLE state
   */
  index : number
  /**
   * The child actor
   */
  childRef : null | ActorRef<any>
}

const condEventOriginIsChild = (ctx: Context) => {
  if (!ctx.event) {
    return false
  }
  // Huan(202112): TODO: remove any
  if (!ctx.childRef || !(ctx.childRef as any).sessionId) {
    return false
  }

  return currentEventOrigin(ctx) === (ctx.childRef as any).sessionId
}

const assignEnqueue = actions.assign<Context>({
  messages: (ctx, _, { _event }) => [
    ...ctx.messages,
    wrapEvent(ctx.event!, _event.origin),
  ],
}) as any

const size = (ctx: Context) => {
  const n = ctx.messages.length - ctx.index
  if (n < 0) {
    throw new Error('size below zero')
  }
  return n
}

const clear = (ctx: Context) => {
  ctx.messages.length = 0
  ctx.index = 0
}

const dequeue = (ctx: Context) => {
  const message = headMessage(ctx)

  if (!message) {
    return undefined
  }

  ctx.index++

  if (size(ctx) === 0) {
    clear(ctx)
  }

  return message
}

const wrapEvent = (event: AnyEventObject, origin?: string) => {
  console.info('wrapEvent:', event, origin)
  const wrappedEvent = ({
    ...event,
    [metaSymKey]: {
      origin,
    },
  })
  console.info('wrapEvent:', wrappedEvent)
  return wrappedEvent
}

const unwrapEvent = (ctx: Context): AnyEventObject => {
  const event = {
    ...currentEvent(ctx),
  }
  delete (event as any)[metaSymKey]
  return event
}

const assignEvent     = actions.assign<Context>({ event: (_, e, { _event }) => wrapEvent(e, _event.origin) }) as any
const assignEventNull = actions.assign<Context>({ event: _ => null }) as any

const currentEvent        = (ctx: Context) => ctx.event!
const currentEventOrigin  = (ctx: Context) => currentEvent(ctx)[metaSymKey].origin
const currentEventType    = (ctx: Context) => currentEvent(ctx).type

const headMessage       = (ctx: Context) => ctx.messages[ctx.index]!
const headMessageOrigin = (ctx: Context) => headMessage(ctx)[metaSymKey].origin
const headMessageType   = (ctx: Context) => headMessage(ctx).type

/**
 * Send the `currentEvent` as the repond to `currentMessage`
 */
const respond = actions.choose<Context, AnyEventObject>([
  {
    /**
     * 1. if head message has an origin, then respond the event to that origin
     */
    cond: ctx => !!headMessageOrigin(ctx),
    actions: [
      actions.log(ctx => `Mailbox contexts.responsd event ${currentEvent(ctx).type}@${currentEventOrigin(ctx)} to message ${headMessage(ctx)}@${headMessageOrigin(ctx)}`),
      actions.send(
        ctx => unwrapEvent(ctx),
        { to: ctx => headMessageOrigin(ctx)! },
      ),
    ],
  },
  /**
   * 2. send to dead letter queue
   */
  {
    actions: [
      actions.log(ctx => `Mailbox contexts.responsd dead letter ${currentEventType(ctx)}@${currentEventOrigin(ctx)}`, 'Mailbox'),
      actions.send(ctx => Events.DEAD_LETTER(
        currentEvent(ctx),
        'head message origin is undefined',
      )),
    ],
  },
])

/**
 * use JSON.parse() to prevent the initial context from being changed
 */
const initialContext: () => Context = () => {
  const context: Context = {
    childRef : null,
    event    : null,
    messages : [],
    index    : 0,
  }
  return JSON.parse(
    JSON.stringify(
      context,
    ),
  )
}

const sendHeadMessage = actions.send<Context, any>(
  ctx => {
    console.info(`Mailbox contexts.sendHeadMessage ${headMessageType(ctx)}@${headMessageOrigin(ctx)}`)
    return headMessage(ctx)
  },
  {
    to: ctx => ctx.childRef!,
  },
) as any

export {
  type Context,
  metaSymKey,
  assignEvent,
  assignEventNull,
  assignEnqueue,
  initialContext,
  condEventOriginIsChild,
  respond,
  sendHeadMessage,
  headMessage,
  headMessageOrigin,
  headMessageType,
  currentEvent,
  currentEventType,
  currentEventOrigin,
  size,
  dequeue,
}
