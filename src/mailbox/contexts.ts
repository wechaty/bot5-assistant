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
  // /**
  //  * child machine
  //  * TODO: remove childRef, just use a top invoke.src with id
  //  */
  // childRef : null | ActorRef<any>
}

/**
 * use JSON.parse() to prevent the initial context from being changed
 */
 const initialContext: () => Context = () => {
  const context: Context = {
    // childRef : null,
    queue : [],
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

const unwrapEvent = (ctx: Context): AnyEventObject => {
  const wrappedEvent = {
    ...currentEvent(ctx)!,
  }
  console.info(`unwrapEvent: ${wrappedEvent.type}@${metaOrigin(wrappedEvent)}`)

  delete (wrappedEvent as any)[metaSymKey]
  return wrappedEvent
}

const assignEvent     = actions.assign<Context>({ event: (_, e, { _event }) => wrapEvent(e, _event.origin) }) as any
const assignEventNull = actions.assign<Context>({ event: _ => null }) as any

const currentEvent        = (ctx: Context) => ctx.event
const currentEventOrigin  = (ctx: Context) => metaOrigin(currentEvent(ctx))
const currentEventType    = (ctx: Context) => currentEvent(ctx)!.type

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

const condCurrentEventOriginIsChild = (ctx: Context, children: Record<string, ActorRef<any, any>>) =>
  currentEventOrigin(ctx) === childSessionId(children)

const currentMessage       = (ctx: Context) => ctx.message
const currentMessageOrigin = (ctx: Context) => metaOrigin(currentMessage(ctx))
const currentMessageType   = (ctx: Context) => currentMessage(ctx)?.type

/**
 * enqueue ctx.event to ctx.queue as a new message
 */
const assignEnqueue = actions.assign<Context>({
  queue: ctx => [
    ...ctx.queue,
    ctx.event!,
  ],
}) as any

/**
 * dequeue ctx.queue to ctx.message (current message)
 */
const assignDequeue = actions.assign<Context>({
  message: ctx => ctx.queue.shift()!,
}) as any

const size = (ctx: Context) => ctx.queue.length

/**
 * Send the ctx.event (current event) to the origin (sender) of ctx.message (current message)
 */
const respond = actions.choose<Context, AnyEventObject>([
  {
    /**
     * 1. if current message has an origin, then respond the event to that origin
     */
    cond: ctx => !!currentMessage(ctx) && !!currentMessageOrigin(ctx),
    actions: [
      actions.log(ctx => `Mailbox contexts.responsd event ${currentEventType(ctx)}@${currentEventOrigin(ctx)} to message ${currentMessage(ctx)}@${currentMessageOrigin(ctx)}`),
      actions.send(
        ctx => unwrapEvent(ctx),
        { to: ctx => currentMessageOrigin(ctx)! },
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
        currentEvent(ctx)!,
        'current message origin is undefined',
      )),
    ],
  },
])

/**
 * Send ctx.message (current message) to child
 */
const sendCurrentMessageToChild = actions.send<Context, any>(
  ctx => {
    console.info(`Mailbox contexts.sendCurrentMessage ${currentMessageType(ctx)}@${currentMessageOrigin(ctx)} to child`)
    return currentMessage(ctx)!
  },
  { to: CHILD_MACHINE_ID },
) as any

export {
  type Context,
  metaSymKey,
  assignEvent,
  assignEventNull,
  assignEnqueue,
  assignDequeue,
  initialContext,
  condCurrentEventOriginIsChild,
  respond,
  sendCurrentMessageToChild,
  currentMessage,
  currentMessageOrigin,
  currentMessageType,
  currentEvent,
  currentEventType,
  currentEventOrigin,
  size,
}
