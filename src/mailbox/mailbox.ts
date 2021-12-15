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
}                       from 'xstate'

import * as contexts  from './contexts.js'
import * as events    from './events.js'
import * as states    from './states.js'
import * as types     from './types.js'

type Typestate =
  | {
    value: typeof states.dispatching,
    context: contexts.Context & {
      actorRef: ActorRef<any>
    },
  }

type Event =
  | ReturnType<typeof events.DISPATCH>
  | ReturnType<typeof events.IDLE>
  | ReturnType<typeof events.RESET>

const wrap = (childMachine: StateMachine<any, any, any, any>) => createMachine<contexts.Context, Event, Typestate>(
  {
    id: 'mailbox',
    // context: factory call to make sure the contexts between separate machines is not the same
    context: () => ({
      ...contexts.initialContext(),
    }),
    initial: states.spawning,
    on: {
      '*': {
        actions: [
          () => console.info('before enqueue'),
          contexts.enqueue,
          () => console.info('after enqueue'),
          (_, __, { _event }) => {
            console.info('[on] *: actions.send(DISPATCH) with _event:', _event)
            return actions.send(events.DISPATCH())
          },
        ],
        target: states.idle,
      },
    },
    states: {
      [states.spawning]: {
        entry: actions.assign({ actorRef: _ => spawn(childMachine) }),
        always: states.idle,
      },
      [states.idle]: {
        entry: actions.log('[states] idle', 'Mailbox'),
        on: {
          [types.DISPATCH]: states.dispatching,
          [types.IDLE]: states.dispatching,
        },
      },
      [states.busy]: {
        on: { [types.IDLE]: states.dispatching },
      },
      [states.dispatching]: {
        entry: [
          actions.log('[states] dispatching', 'Mailbox'),
        ],
        always: [
          { // new event in queue
            cond: contexts.nonempty,
            actions: [
              contexts.dequeue,
              actions.log('new event in queue', 'Mailbox'),
            ],
            target: states.delivering,
          },
          {
            actions: actions.log('no new event in queue', 'Mailbox'),
            target: states.idle,
          },
        ],
      },
      [states.delivering]: {
        entry: [
          actions.log('[states] delivering', 'Mailbox'),
          ctx => ctx.current && actions.send(
            ctx.current,
            {
              to: _ => ctx.actorRef!,
            },
          ),
        ],
        always: states.busy,
        exit: [
          actions.assign({
            current: _ => null,
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
