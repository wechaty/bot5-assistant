/**
 *   Mailbox - https://github.com/huan/mailbox
 *    author: Huan LI (李卓桓) <zixia@zixia.net>
 *    Dec 2021
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */
/**
 * Mailbox provides the address for XState Actors:
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
}                   from 'xstate'

import { IS_DEVELOPMENT } from './config.js'

import * as contexts      from './contexts.js'
import {
  Events,
  Event,
}                         from './events.js'
import { States }         from './states.js'
import {
  Types,
  isMailboxType,
  CHILD_MACHINE_ID,
}                         from './types.js'
import { validate }       from './validate.js'

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
   * when in developement mode, we will validate the childMachine
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
    Event | { type: TEvent['type'] }
  >({
    id: 'mailbox',
    invoke: {
      id: CHILD_MACHINE_ID,
      src: childMachine,
    },
    type: 'parallel',
    /**
     * initialize context:
     *  factory call to make sure the contexts will not be modified
     *  by mistake from other machines
     */
    context: () => contexts.initialContext(),
    /**
     * Issue statelyai/xstate#2891:
     *  The context provided to the expr inside a State
     *  should be exactly the **context in this state**
     * @see https://github.com/statelyai/xstate/issues/2891
     */
    preserveActionOrder: true,
    states: {
      postman: {
        /**
         * queue states transitions are all SYNC
         */
        initial: States.standby,
        states: {
          [States.standby]: {
            entry: [
              actions.log('states.postman.standby.entry', 'Mailbox'),
            ],
            on: {
              [Types.DISPATCH]: States.dispatching,
            },
          },
          [States.dispatching]: {
            entry: [
              actions.log((_, e) => 'states.postman.dispatching.entry ' + (e as ReturnType<typeof Events.DISPATCH>).payload.info, 'Mailbox'),
            ],
            always: [
              {
                cond: ctx => contexts.size(ctx) > 0,
                actions: [
                  actions.log(ctx => `states.postman.dispatching.always queue size ${contexts.size(ctx)}, transition to delivering`, 'Mailbox'),
                  contexts.assignDequeue,
                ],
                target: States.delivering,
              },
              {
                actions: actions.log('states.postman.dispatching.always queue is empty, transition to standby', 'Mailbox'),
                target: States.standby,
              },
            ],
          },
          [States.delivering]: {
            entry: [
              actions.log(ctx => `states.postman.delivering.entry ${contexts.currentMessageType(ctx)}@${contexts.currentMessageOrigin(ctx)}`, 'Mailbox'),
              actions.send(ctx => Events.CHILD_BUSY(contexts.currentMessageType(ctx))),
              contexts.sendCurrentMessageToChild,
            ],
            always: States.standby,
          },
        },
      },
      child: {
        initial: States.idle,
        states: {
          // [States.spawning]: {
          //   /**
          //    * TODO: remove spawning, use invoke at top level instead
          //    */
          //   entry: [
          //     actions.log('states.child.spawning.entry', 'Mailbox'),
          //     actions.assign({ childRef : _ => spawn(childMachine) }),
          //   ],
          //   always: States.idle,
          //   exit: [
          //     actions.log(_ => 'states.child.spawning.exit', 'Mailbox'),
          //   ],
          // },
          [States.idle]: {
            /**
             * SEND event MUST be only send from child.idle
             *  because it will drop the current message and dequeue the next one
             */
            entry: [
              actions.log('states.child.idle.entry', 'Mailbox'),
              actions.send(Events.DISPATCH(States.idle)),
            ],
            on: {
              [Types.CHILD_BUSY]: States.busy,
              [Types.NEW_MESSAGE]: {
                actions: [
                  actions.send(Events.DISPATCH(Types.NEW_MESSAGE)),
                ],
              },
            },
          },
          [States.busy]: {
            entry: actions.log((_, e) => 'states.child.busy.entry ' + (e as ReturnType<typeof Events.CHILD_BUSY>).payload.info, 'Mailbox'),
            on: {
              [Types.CHILD_IDLE]: States.idle,
            },
          },
        },
      },
      router: {
        initial: States.listening,
        states: {
          [States.listening]: {
            entry: [
              actions.log((_, e) => 'states.router.listening.entry ' + e.type, 'Mailbox'),
            ],
            on: {
              '*': {
                target: States.routing,
                actions: contexts.assignEvent,
              },
            },
          },
          [States.routing]: {
            entry: [
              actions.log((_, e, { _event }) => `states.router.routing.entry event: ${e.type}@${_event.origin || ''}`, 'Mailbox'),
              actions.log(ctx => `states.router.routing.entry ctx.event: ${contexts.currentEventType(ctx)}@${contexts.currentEventOrigin(ctx)} ${JSON.stringify(ctx.event)}`, 'Mailbox'),
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
              // {
              //   cond: ctx => {
              //     console.info(`Mailbox states.router.routing.always [expr] context.event: ${contexts.currentEventType(ctx)}@${contexts.currentEventOrigin(ctx)}`)
              //     /**
              //      * always `false` for log only
              //      *
              //      * TODO: any better way for logging?
              //      */
              //     return false
              //   },
              //   actions: [],
              // },
              {
                /**
                 * 1. Autocrine signalling from mailbox itself
                 *
                 * skip all EVENTs send from mailbox itself
                 *
                 * NOTICE: this should be placed as the first
                 *  because the child might send MailboxType EVENTs (with child origin) which should not
                 *    be put to `outgoing`
                 */
                cond: ctx => isMailboxType(contexts.currentEventType(ctx)),
                actions: [
                  actions.log(ctx => `states.router.routing.always autocrine signal: isMailboxType(${contexts.currentEventType(ctx)})`, 'Mailbox'),
                  contexts.assignEventNull,
                ],
                target: States.listening,
              },
              {
                /**
                 *  2. Paracrine signalling from child machine
                 */
                cond: (ctx, _, { state }) => contexts.condCurrentEventOriginIsChild(ctx, state.children),
                actions: actions.log(ctx => `states.router.routing.always paracrine signal: condCurrentEventOriginIsChild(${contexts.currentEventOrigin(ctx)})`, 'Mailbox'),
                target: States.outgoing,
              },
              {
                /**
                 * 3. Endocrine signalling from external actors
                 *
                 * Current event is sent from other actors (neither child nor mailbox)
                 */
                actions: actions.log(ctx => `states.router.routing.always endocrine signal: ${contexts.currentEventType(ctx)}@${contexts.currentEventOrigin(ctx)}`, 'Mailbox'),
                target: States.incoming,
              },
            ],
          },
          [States.incoming]: {
            entry: [
              actions.log(ctx => `states.router.incoming.entry ${contexts.currentEventType(ctx)}@${contexts.currentEventOrigin(ctx)}`, 'Mailbox'),
              contexts.assignEnqueue,
              actions.send(ctx => Events.NEW_MESSAGE(contexts.currentEventType(ctx))),
            ],
            always: States.listening,
            exit: [
              actions.log(_ => 'states.router.incoming.exit', 'Mailbox'),
              contexts.assignEventNull,
            ],
          },
          [States.outgoing]: {
            entry: [
              actions.log(ctx => `states.router.outgoing.entry ${contexts.currentEventType(ctx)}@${contexts.currentEventOrigin(ctx)}`, 'Mailbox'),
              contexts.respond,
            ],
            always: States.listening,
            exit: [
              actions.log(_ => 'states.router.outgoing.exit', 'Mailbox'),
              contexts.assignEventNull,
            ]
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
