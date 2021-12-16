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
    events.Event | TEvent,  // add child event types to mailbox event types
    Typestate<contexts.Context>
  >(
    {
      id: 'mailbox',
      // context: factory call to make sure the contexts between separate machines is not the same
      context: () => ({
        ...contexts.initialContext(),
      }),
      initial: states.spawning,
      on: {
        /**
         * Proxy EVENTs rules:
         *  1. skip all EVENTs send from mailbox itself
         *  2. enqueue all EVENTs which are not sent from child machine
         *  3. mailbox.respond all EVENTs send from child machine
         */
        [types.DISPATCH]: undefined,
        [types.RESET]: undefined,
        [types.IDLE]: undefined,
        '*': {
          actions: [
            contexts.assignEnqueue,
            actions.send(
              (ctx, e, { _event }) => {
                if (_event.origin && _event.origin === ctx.childRef?.sessionId) {
                  console.info('FOUND event from child:', _event.origin)
                } else {
                  console.info('FOUND event NOT from child:', _event.origin)
                }
                console.info('[on] *: current queue length:', ctx.queue.length)
                console.info('mailbox.on.*.actions.send(DISPATCH) with _event:', JSON.stringify(_event))
                return events.DISPATCH()
              },
              {
                to: (ctx, e, { _event }) => {
                  return undefined as any
                },
              },
            ),
          ],
        },
      },
      states: {
        [states.spawning]: {
          entry: [
            actions.assign({ childRef: _ => spawn(childMachine) }),
            actions.log('states.spawning.entry', 'Mailbox'),
          ],
          always: states.idle,
          exit: [
            actions.log('states.spawning.exit', 'Mailbox'),
          ],
        },
        [states.idle]: {
          entry: actions.log('states.idle.entry', 'Mailbox'),
          on: {
            [types.DISPATCH]: states.dispatching,
            [types.IDLE]: {
              target: states.dispatching,
              actions: [
                actions.log((_, e, m) => `states.idle.on(IDLE) with event(${e.type}) from ${m._event.origin}`, 'Mailbox'),
              ],
            },
          },
        },
        [states.busy]: {
          on: {
            [types.IDLE]: states.dispatching,
          },
        },
        [states.responding]: {
          entry: [
            actions.log((_, __, { _event }) => 'states.responding.entry ' + JSON.stringify(_event), 'Mailbox'),
          ],
          always: [
            {
              cond: contexts.condChildEvent,
              actions: [
                actions.send(
                  (_, e, { _event }) => {
                    console.info('Mailbox states.responding.entry', JSON.stringify(_event))
                    return e
                  },
                  {
                    to: ctx => ctx.current?.meta.origin!,
                  },
                ),
              ],
              target: states.busy,
            },
            {
              target: states.busy,
              actions: [
                actions.log('states.responding.always.target states.busy (not child event)', 'Mailbox'),
              ],
            },
          ],
          exit: [
            actions.log('states.responding.exit', 'Mailbox'),
          ],
        },
        [states.dispatching]: {
          entry: [
            actions.log('states.dispatching.entry', 'Mailbox'),
          ],
          always: [
            { // new event in queue
              cond: contexts.condNonempty,
              actions: [
                contexts.assignDequeue,
                actions.log('states.dispatching.always condNonempty()', 'Mailbox'),
              ],
              target: states.delivering,
            },
            {
              actions: actions.log('states.dispatching.always default(queue is empty)', 'Mailbox'),
              target: states.idle,
            },
          ],
        },
        [states.delivering]: {
          entry: [
            actions.log('states.delivering.entry', 'Mailbox'),
            actions.send(
              ctx => {
                console.info('Mailbox states.delivering ctx.current:', ctx.current)
                return ctx.current!
              },
              {
                to: ctx => ctx.childRef!,
              },
            ),
          ],
          always: states.busy,
          exit: [
            actions.assign({
              current: _ => {
                console.info('Mailbox states.delivering.exit set ctx.current to null')
                return null
              },
            }),
          ],
        },
      },
    },
    {
      actions: {},
      services: {},
    },
  )

export {
  wrap,
  types,
  events,
  states,
  contexts,
}
