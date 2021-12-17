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
  ActorRef,
  AnyEventObject,
  EventObject,
  StateSchema,
  Typestate,
}                       from 'xstate'

import {
  registry, // FIXME: find a good way to get child by `session`
}                     from 'xstate/lib/registry.js'

import * as contexts  from './contexts.js'
import * as events    from './events.js'
import * as states    from './states.js'
import * as types     from './types.js'

// type MailboxTypestate =
//   | {
//     value: typeof states.dispatching,
//     context: contexts.Context & {
//       actorRef: ActorRef<any>
//     },
//   }

const nullActor = createMachine({})

const wrap = <
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
    events.Event | { type: TEvent['type'] },
    Typestate<contexts.Context>
  >(
    {
      id: 'mailbox',
      type: 'parallel',
      // context: factory call to make sure the contexts between separate machines is not the same
      context: () => ({
        ...contexts.initialContext(),
      }),
      initial: states.spawning,
      states: {
        message: {
          initial: states.idle,
          states: {
            [states.idle]: {
              entry: [
                actions.log('states.message.idle.entry', 'Mailbox'),
              ],
              on: {
                [types.DISPATCH]: states.dispatching,
              },
            },
            [states.dispatching]: {
              entry: [
                actions.log((_, e) => 'tates.message.dispatching.entry ' + (e as any).payload.reason, 'Mailbox'),
              ],
              always: [
                { // new event in queue
                  cond: contexts.condMessageQueueNonempty,
                  actions: [
                    contexts.assignDequeueMessage,
                    actions.log('states.message.dispatching.always condMessageQueueNonempty (true)', 'Mailbox'),
                  ],
                  target: states.delivering,
                },
                {
                  actions: actions.log('states.message.dispatching.always idle', 'Mailbox'),
                  target: states.idle,
                },
              ],
            },
            [states.delivering]: {
              entry: [
                actions.log(ctx => 'states.message.delivering.entry ' + ctx.currentMessage?.type, 'Mailbox'),
                actions.send(ctx => events.BUSY(ctx.currentMessage!.type)),
              ],
              always: states.idle,
              exit: [
                contexts.sendCurrentMessageToChild,
              ],
            },
          },
        },
        child: {
          initial: states.spawning,
          states: {
            [states.spawning]: {
              entry: [
                actions.log('states.child.spawning.entry', 'Mailbox'),
                actions.assign({
                  childRef : _ => spawn(childMachine),
                  nullRef  : _ => spawn(nullActor),
                }),
              ],
              always: states.idle,
            },
            [states.idle]: {
              entry: [
                actions.log('states.child.idle.entry', 'Mailbox'),
                actions.send(events.DISPATCH(types.IDLE)),
              ],
              on: {
                [types.BUSY]: states.busy,
                [types.NOTIFY]: {
                  target: states.busy,
                  actions: [
                    actions.send(_ => events.DISPATCH(types.NOTIFY)),
                  ],
                },
              },
            },
            [states.busy]: {
              // TODO: remove any
              entry: actions.log((_, e) => 'states.child.busy.entry ' + (e as any).payload.reason, 'Mailbox'),
              on: {
                [types.IDLE]: states.idle,
              },
            },
          },
        },
        router: {
          initial: states.idle,
          states: {
            [states.idle]: {
              entry: [
                actions.log('states.router.idle.entry', 'Mailbox'),
              ],
              on: {
                '*': states.routing,
              },
            },
            [states.routing]: {
              entry: [
                actions.log((_, __, { _event }) => 'states.router.routing.entry ' + JSON.stringify(_event), 'Mailbox'),
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
                  cond: events.condCurrentEventFromMailbox,
                  target: states.idle,
                },
                {
                  cond: contexts.condCurrentEventFromChild,
                  target: states.outgoing,
                },
                {
                  description: 'current event is sent from other actors (neither child nor mailbox)',
                  target: states.incoming,
                },
              ],
            },
            [states.incoming]: {
              entry: [
                actions.log(ctx => 'states.router.incoming.entry ' + JSON.stringify(ctx.currentEvent), 'Mailbox'),
                contexts.assignEnqueueMessage,
              ],
              always: states.idle,
              exit: [
                actions.log(_ => 'states.incoming.exit', 'Mailbox'),
                actions.send(ctx => events.NOTIFY(ctx.currentEvent?.type)),
              ],
            },
            [states.outgoing]: {
              entry: [
                actions.log(ctx => 'states.router.outgoing.entry ' + JSON.stringify(ctx.currentEvent), 'Mailbox'),
                contexts.respond,
              ],
              always: states.idle,
            },
          },
        },
      },
    },
  )

export {
  wrap,
  types,
  events,
  states,
  contexts,
}
