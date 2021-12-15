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

import {
  registry, // FIXME: find a good way to get child by `session`
}                     from 'xstate/lib/registry.js'

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
          contexts.enqueue(),
          actions.send((_, __, meta) => {
            // console.info('[on] *: actions.send(DISPATCH) with _event:', _event)
            if (meta._event.origin) {
              // this.children.get(to as string) || registry.get(to as string)
              console.info('meta:', meta)
              console.info('registry.get():', registry.get(meta._event.origin))
            }
            console.info('[on] *: current queue length:', _.queue.length)
            return events.DISPATCH()
          }),
        ],
        target: states.idle,
      },
    },
    states: {
      [states.spawning]: {
        entry: [
          actions.assign({ actorRef: _ => spawn(childMachine) }),
          actions.log('[spawning] entry'),
        ],
        always: states.idle,
        exit: [
          actions.log('[spawning] exit'),
        ],
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
          actions.log('[states] enter dispatching', 'Mailbox'),
        ],
        always: [
          { // new event in queue
            cond: contexts.nonempty(),
            actions: [
              contexts.dequeue(),
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
          actions.send(
            ctx => {
              console.info('current:', ctx.current)
              return ctx.current!
            },
            ({
              to: ctx => ctx.actorRef!,
            }),
          ),
        ],
        always: states.busy,
        exit: [
          actions.assign({
            current: _ => {
              console.info('clean on exit current -> null')
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
