/**
 * XState Actors:
 *  @see https://xstate.js.org/docs/guides/actors.html#actor-api
 */

/* eslint-disable sort-keys */
import {
  actions,
  createMachine,
  StateMachine,
  spawn,
  AnyEventObject,
  EventObject,
  Typestate,
}                       from 'xstate'
import { IS_DEVELOPMENT } from './config.js'

import * as contexts  from './contexts.js'
import {
  Events,
  Event,
}                     from './events.js'
import { States }     from './states.js'
import {
  Types,
  isMailboxType,
}                     from './types.js'
import { validate } from './validate.js'

const address = <
  TEvent extends EventObject = AnyEventObject,
>(
    childMachine: StateMachine<
      any,
      any,
      TEvent
    >,
  ) => {
  /**
   * Debugging: do validating when in developement mode
   */
  if (IS_DEVELOPMENT && !validate(childMachine)) {
    throw new Error('Mailbox.address: childMachine is not valid')
  }

  const machine = createMachine<
    contexts.Context,
    /**
     * add child event types to mailbox event types
     *
     * Huan(202112) TODO: remove the `TEvent['type']` and just use `TEvent`
     */
    Event | { type: TEvent['type'] },
    Typestate<contexts.Context>
  >({
    id: 'mailbox',
    type: 'parallel',
    /**
     * initialize context:
     *  factory call to make sure the contexts not the same
     *  between separate machines
     */
    context: () => contexts.initialContext(),
    states: {
      message: {
        initial: States.idle,
        states: {
          [States.idle]: {
            entry: [
              actions.log('states.message.idle.entry', 'Mailbox'),
            ],
            on: {
              [Types.DISPATCH]: States.dispatching,
            },
          },
          [States.dispatching]: {
            entry: [
              actions.log((_, e) => 'states.message.dispatching.entry ' + (e as any).payload.reason, 'Mailbox'),
            ],
            always: [
              { // new event in queue
                cond: contexts.condMessageQueueNonempty,
                actions: [
                  contexts.assignDequeueMessage,
                  actions.log(ctx => 'states.message.dispatching.always condMessageQueueNonempty:' + ctx.messageQueue.length, 'Mailbox'),
                ],
                target: States.delivering,
              },
              {
                actions: actions.log('states.message.dispatching.always idle', 'Mailbox'),
                target: States.idle,
              },
            ],
          },
          [States.delivering]: {
            entry: [
              actions.log(ctx => 'states.message.delivering.entry ' + ctx.currentMessage?.type + '@' + contexts.getOrigin(ctx), 'Mailbox'),
              actions.send(ctx => Events.BUSY(ctx.currentMessage!.type)),
            ],
            always: States.idle,
            exit: [
              contexts.sendCurrentMessageToChild,
            ],
          },
        },
      },
      child: {
        initial: States.spawning,
        states: {
          [States.spawning]: {
            entry: [
              actions.log('states.child.spawning.entry', 'Mailbox'),
              actions.assign({ childRef : _ => spawn(childMachine) }),
            ],
            always: States.idle,
            exit: [
              actions.log(_ => 'states.child.spawning.exit', 'Mailbox'),
            ],
          },
          [States.idle]: {
            entry: [
              actions.log('states.child.idle.entry', 'Mailbox'),
              actions.send(_ => Events.DISPATCH(Types.RECEIVE)),
            ],
            on: {
              [Types.BUSY]: States.busy,
              [Types.NOTIFY]: {
                // target: States.busy,
                actions: [
                  actions.send(_ => Events.DISPATCH(Types.NOTIFY)),
                ],
              },
            },
          },
          [States.busy]: {
            // TODO: remove any
            entry: actions.log((_, e) => 'states.child.busy.entry ' + (e as any).payload.reason, 'Mailbox'),
            on: {
              [Types.RECEIVE]: States.idle,
            },
          },
        },
      },
      router: {
        initial: States.idle,
        states: {
          [States.idle]: {
            entry: [
              actions.log((_, e) => 'states.router.idle.entry ' + e.type, 'Mailbox'),
            ],
            on: {
              '*': {
                target: States.routing,
                actions: contexts.assignCurrentEvent,
              },
            },
          },
          [States.deadLetter]: {
            entry: [
              actions.log(_ => 'states.router.dead.entry', 'Mailbox'),
              actions.send(ctx => Events.DEAD_LETTER(
                'dead letter',
                ctx.currentEvent!,
              )),
            ],
            always: States.idle,
            exit: [
              actions.assign({ currentEvent: _ => null }),
            ],
          },
          [States.routing]: {
            entry: [
              actions.log((_, e, { _event }) => 'states.router.routing.entry e: ' + e.type + '@' + (_event.origin || ''), 'Mailbox'),
              actions.log(ctx => 'states.router.routing.entry ctx.currentEvent: ' + ctx.currentEvent?.type + '@' + contexts.getOrigin(ctx), 'Mailbox'),
            ],
            /**
             * Proxy EVENTs rules:
             *  1. skip all EVENTs send from mailbox itself
             *  2. enqueue all EVENTs which are not sent from child machine
             *  3. mailbox.respond all EVENTs send from child machine
             *
             * Difference Between Autocrine and Paracrine, @Samanthi, July 29, 2018
             *  @see https://www.differencebetween.com/difference-between-autocrine-and-paracrine
             */
            always: [
              /**
               * Debugging: `cond` always return `false`
               */
              {
                cond: (ctx, e, { _event }) => {
                  console.info('HUAN:', e.type, _event.origin)
                  console.info('states.router.routing.always ctx.currentEvent: ' + ctx.currentEvent?.type + '@' + contexts.getOrigin(ctx), 'Mailbox')
                  return false
                },
                actions: [],
              },
              {
                /**
                 * 1. Autocrine signalling from mailbox itself(cell)
                 *
                 * skip all EVENTs send from mailbox itself
                 *
                 * NOTICE: this should be placed as the first
                 *  because the child might send MailboxType EVENTs (with child origin) which should not
                 *    be put to `outgoing`
                 */
                cond: ctx => isMailboxType(ctx.currentEvent?.type),
                actions: [
                  actions.log(ctx => 'states.router.routing.always autocrine signal: isMailboxType(' + ctx.currentEvent?.type + ')', 'Mailbox'),
                  actions.assign({ currentEvent: _ => null }),
                ],
                target: States.idle,
              },
              {
                /**
                 *  2. Paracrine signalling from child machine(cell)
                 */
                cond: ctx => contexts.condCurrentEventOriginIsChild(ctx),
                actions: actions.log(ctx => 'states.router.routing.always paracrine signal: condCurrentEventOriginIsChild(' + (contexts.getOrigin(ctx) || '') + ')', 'Mailbox'),
                target: States.outgoing,
              },
              {
                /**
                 * 3. Endocrine signalling from external actors (cell/machine)
                 *
                 * Current event is sent from other actors (neither child nor mailbox)
                 */
                actions: actions.log(ctx => 'states.router.routing.always endocrine signal:' + ctx.currentEvent?.type + '@' + (contexts.getOrigin(ctx) || ''), 'Mailbox'),
                target: States.incoming,
              },
            ],
          },
          [States.incoming]: {
            entry: [
              actions.log(ctx => 'states.router.incoming.entry ' + ctx.currentEvent?.type + '@' + (contexts.getOrigin(ctx) || ''), 'Mailbox'),
              contexts.assignEnqueueMessage,
            ],
            always: States.idle,
            exit: [
              actions.log(_ => 'states.router.incoming.exit', 'Mailbox'),
              actions.send(ctx => Events.NOTIFY(ctx.currentEvent?.type)),
            ],
          },
          [States.outgoing]: {
            entry: [
              actions.log(ctx => 'states.router.outgoing.entry ' + ctx.currentEvent?.type + '@' + (contexts.getOrigin(ctx) || ''), 'Mailbox'),
              contexts.respond,
            ],
            always: States.idle,
          },
        },
      },
    },
  })
  return machine
}

export {
  address,
}
