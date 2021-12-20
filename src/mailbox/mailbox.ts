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

import * as contexts  from './contexts.js'
import {
  Events,
  Event,
}                                 from './events.js'
import { States }    from './states.js'
import {
  Types,
  isMailboxType,
}                     from './types.js'

// type MailboxTypestate =
//   | {
//     value: typeof States.dispatching,
//     context: contexts.Context & {
//       actorRef: ActorRef<any>
//     },
//   }

const nullMachine = createMachine({})

const address = <
  TEvent extends EventObject = AnyEventObject,
>(
    childMachine: StateMachine<
      any,
      any,
      TEvent
    >,
  ) => createMachine<
    contexts.Context,
    /**
     * add child event types to mailbox event types
     *
     * Huan(202112) TODO: remove the `TEvent['type']` and just use `TEvent`
     */
    Event | { type: TEvent['type'] },
    Typestate<contexts.Context>
  >(
    {
      id: 'mailbox',
      type: 'parallel',
      // context: factory call to make sure the contexts between separate machines is not the same
      context: () => ({
        ...contexts.initialContext(),
      }),
      initial: States.spawning,
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
                    actions.log('states.message.dispatching.always condMessageQueueNonempty (true)', 'Mailbox'),
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
                actions.log(ctx => 'states.message.delivering.entry ' + ctx.currentMessage?.type, 'Mailbox'),
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
                actions.assign({
                  childRef : _ => spawn(childMachine),
                  nullRef  : _ => spawn(nullMachine),
                }),
              ],
              always: States.idle,
              exit: [
                actions.log(ctx => 'states.child.spawning.exit ctx.childRef:' + !!ctx.childRef, 'Mailbox'),
              ],
            },
            [States.idle]: {
              entry: [
                actions.log('states.child.idle.entry', 'Mailbox'),
                actions.send(Events.DISPATCH(Types.IDLE)),
              ],
              on: {
                [Types.BUSY]: States.busy,
                [Types.NOTIFY]: {
                  target: States.busy,
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
                [Types.IDLE]: States.idle,
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
                '*': States.routing,
              },
            },
            [States.routing]: {
              entry: [
                actions.log((_, e) => 'states.router.routing.entry ' + e.type, 'Mailbox'),
                contexts.assignCurrentEvent,
              ],
              /**
               * Proxy EVENTs rules:
               *  1. skip all EVENTs send from mailbox itself
               *  2. enqueue all EVENTs which are not sent from child machine
               *  3. mailbox.respond all EVENTs send from child machine
               */
              always: [
                /**
                 * skip all EVENTs send from mailbox itself
                 *
                 * NOTICE: this should be placed as the first
                 *  because the child might send IDLE which should not
                 *    be put to `outgoing`
                 */
                {
                  cond: ctx => isMailboxType(ctx.currentEvent?.type),
                  actions: actions.log('states.router.routing.always isMailboxType (true)', 'Mailbox'),
                  target: States.idle,
                },
                {
                  cond: ctx => contexts.condCurrentEventOriginIsChild(ctx),
                  actions: actions.log('states.router.routing.always condCurrentEventOriginIsChild (true)', 'Mailbox'),
                  target: States.outgoing,
                },
                {
                  description: 'current event is sent from other actors (neither child nor mailbox)',
                  actions: actions.log('states.router.routing.always current event is sent from other actors', 'Mailbox'),
                  target: States.incoming,
                },
              ],
            },
            [States.incoming]: {
              entry: [
                actions.log(ctx => 'states.router.incoming.entry ' + ctx.currentEvent.type, 'Mailbox'),
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
                actions.log(ctx => 'states.router.outgoing.entry ' + ctx.currentEvent.type, 'Mailbox'),
                contexts.respond,
              ],
              always: States.idle,
            },
          },
        },
      },
    },
  )

export {
  address,
}
