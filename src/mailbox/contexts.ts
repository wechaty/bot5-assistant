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
  Interpreter,
}                   from 'xstate'

import { Events } from './events.js'
import { CHILD_MACHINE_ID } from './types.js'

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
   * current event: every event that the state machine received will be stored in `event`
   *  1. system events (Mailbox.Types.*)
   *  2. user events (Child.Types.*)
   */
  event: null | AnyEventObjectExt
  /**
   * current message: only received events should sent to child, is a `message`
   *
   * current message: actor module must only process one message one time
   *  a message will only start to be processed (send to the child)
   *  when the child is ready for processing the next message
   */
  message: null | AnyEventObjectExt
  /**
   * message queue: `queue` is for storing the messages. message is an event: (external events, which should be proxyed to the child)
   *  1. neither sent from mailbox
   *  2. nor from child
   */
  queue: AnyEventObjectExt[]
  index: number // current message index in queue
}

/**
 * use JSON.parse() to prevent the initial context from being changed
 */
 const initialContext: () => Context = () => {
  const context: Context = {
    // childRef : null,
    queue : [],
    index: 0,
    message  : null,
    event    : null,
  }
  return JSON.parse(
    JSON.stringify(
      context,
    ),
  )
}

const metaOrigin = (event?: null | AnyEventObjectExt) => event && event[metaSymKey].origin || ''

const wrapEvent = (event: AnyEventObject, origin?: string) => {
  const wrappedEvent = ({
    ...event,
    [metaSymKey]: {
      origin,
    },
  })
  console.info(`wrapEvent: ${wrappedEvent.type}@${metaOrigin(wrappedEvent)}`)
  return wrappedEvent
}

const unwrapEvent = (e: AnyEventObjectExt): AnyEventObject => {
  const wrappedEvent = {
    ...e,
  }
  console.info(`unwrapEvent: ${wrappedEvent.type}@${metaOrigin(wrappedEvent)}`)

  delete (wrappedEvent as any)[metaSymKey]
  return wrappedEvent
}

/*********************
 *
 * Utils
 *
 *********************/

const childSessionId = (children: Record<string, ActorRef<any, any>>) => {
  const child = children[CHILD_MACHINE_ID] as undefined | Interpreter<any>
  if (!child) {
    throw new Error('can not found child id ' + CHILD_MACHINE_ID)
  }

  if (!child.sessionId) {
    /**
     * Huan(202112):
     *
     * When we are not using the interpreter, we can not get the sessionId
     * for example, we are usint the `machine.transition(event)`
     */
    // console.error(new Error('can not found child sessionId from ' + CHILD_MACHINE_ID))
    return undefined
  }

  return child.sessionId
}

/*****************************
 *
 * sub state of: router
 *
 *****************************/

const assignRoutingEvent     = actions.assign<Context>({ event: (_, e, { _event }) => wrapEvent(e, _event.origin) }) as any
const assignRoutingEventNull = actions.assign<Context>({ event: _ => null }) as any

const routingEvent        = (ctx: Context) => ctx.event
const routingEventOrigin  = (ctx: Context) => metaOrigin(routingEvent(ctx))
const routingEventType    = (ctx: Context) => routingEvent(ctx)?.type

const condRoutingEventOriginIsChild = (ctx: Context, children: Record<string, ActorRef<any, any>>) =>
  routingEventOrigin(ctx) === childSessionId(children)

const childMessage       = (ctx: Context) => ctx.message
const childMessageOrigin = (ctx: Context) => metaOrigin(childMessage(ctx))
const childMessageType   = (ctx: Context) => childMessage(ctx)?.type

/**************************
 *
 * sub state of: queue
 *
 **************************/

/**
 * enqueue message to ctx.queue as a new message
 */
const assignEnqueue = actions.assign<Context>({
  queue: (ctx, e) => [
    ...ctx.queue,
    (e as ReturnType<typeof Events.ENQUEUE>).payload.message,
  ],
}) as any

/**
 * dequeue ctx.queue by increasing index by 1 (current message pointer move forward)
 */
const assignDequeue = actions.assign<Context>({
  // message: ctx => ctx.queue.shift()!,
  index: ctx => ctx.index + 1,
}) as any

const assignEmptyQueue = actions.assign<Context>({
  queue: _ => [],
  index: _ => 0,
}) as any

const queueSize     = (ctx: Context) => ctx.queue.length - ctx.index
const queueMessage  = (ctx: Context) => ctx.queue[ctx.index]
const queueMessageType = (ctx: Context) => ctx.queue[ctx.index]?.type
const queueMessageOrigin = (ctx: Context) => metaOrigin(ctx.queue[ctx.index])

/**************************
 *
 * substate of: Child
 *
 *************************/

/**
 * Send the CHILD_RESPOND.payload.message to the origin (sender) of ctx.message (child message which is current processing)
 */
const respondChildMessage = actions.choose<Context, AnyEventObject>([
  {
    /**
     * 1. if current message has an origin, then respond the event to that origin
     */
    cond: ctx => !!childMessage(ctx) && !!childMessageOrigin(ctx),
    actions: [
      actions.log((ctx, e) => `Mailbox contexts.responsd event ${(e as ReturnType<typeof Events.CHILD_RESPOND>).payload.message.type}@${metaOrigin((e as ReturnType<typeof Events.CHILD_RESPOND>).payload.message)} to message ${childMessage(ctx)}@${childMessageOrigin(ctx)}`),
      actions.send(
        (_, e) => unwrapEvent((e as ReturnType<typeof Events.CHILD_RESPOND>).payload.message),
        { to: ctx => childMessageOrigin(ctx)! },
      ),
    ],
  },
  /**
   * 2. send to dead letter queue
   */
  {
    actions: [
      actions.log(ctx => `Mailbox contexts.responsd dead letter ${routingEventType(ctx)}@${routingEventOrigin(ctx)}`, 'Mailbox'),
      actions.send((_, e) => Events.DEAD_LETTER(
        (e as ReturnType<typeof Events.CHILD_RESPOND>).payload.message,
        'child message origin is undefined',
      )),
    ],
  },
]) as any

const assignChildMessage = actions.assign<Context>({
  message: (_, e) => {
    return (e as ReturnType<typeof Events.DEQUEUE>).payload.message
  },
}) as any

/**
 * Send ctx.message (current message) to child
 */
const sendChildMessage = actions.send<Context, any>(
  ctx => {
    console.info(`Mailbox contexts.sendCurrentMessage ${childMessageType(ctx)}@${childMessageOrigin(ctx)} to child`)
    return childMessage(ctx)!
  },
  { to: CHILD_MACHINE_ID },
) as any

/**************
 *
 * exports
 *
 **************/
export {
  type Context,
  type AnyEventObjectExt,
  metaSymKey,
  initialContext,
  metaOrigin,
  /**
   * actions.assign<Context>({...})
   */
  assignRoutingEvent,
  assignRoutingEventNull,
  assignEnqueue,
  assignDequeue,
  assignEmptyQueue,
  assignChildMessage,
  /**
   * actions.respond(...)
   */
  respondChildMessage,
  /**
   * actions.send(...)
   */
  sendChildMessage,
  /**
   * ctx.message helpers
   */
  childMessage,
  childMessageOrigin,
  childMessageType,
  /**
   * ctx.event helpers
   */
  routingEvent,
  routingEventType,
  routingEventOrigin,
  /**
   * ctx.queue helpers
   */
  queueSize,
  queueMessage,
  queueMessageType,
  queueMessageOrigin,
  /**
   * cond: ...
   */
   condRoutingEventOriginIsChild,
  }
