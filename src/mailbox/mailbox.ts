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
      queue: {
        /**
         * queue states transitions are all SYNC
         */
        initial: States.idle,
        states: {
          [States.idle]: {
            entry: [
              actions.log('states.queue.idle.entry', 'Mailbox'),
            ],
            on: {
              [Types.SEND]: States.dispatching,
            },
          },
          [States.dispatching]: {
            entry: [
              actions.log((_, e) => 'states.queue.dispatching.entry ' + (e as ReturnType<typeof Events.SEND>).payload.info, 'Mailbox'),
            ],
            always: [
              {
                cond: ctx => !contexts.empty(ctx),
                actions: [
                  actions.log(_ => 'states.queue.dispatching.always queue is nonempty, transition to delivering', 'Mailbox'),
                  contexts.assignDequeue,
                ],
                target: States.delivering,
              },
              {
                actions: actions.log('states.queue.dispatching.always queue is empty, transition to idle', 'Mailbox'),
                target: States.idle,
              },
            ],
          },
          [States.delivering]: {
            entry: [
              actions.log(ctx => `states.queue.delivering.entry ${contexts.currentMessageType(ctx)}@${contexts.currentMessageOrigin(ctx)}`, 'Mailbox'),
              actions.send(ctx => Events.BUSY(contexts.currentMessageType(ctx))),
              contexts.sendCurrentMessageToChild,
            ],
            always: States.idle,
          },
        },
      },
      child: {
        initial: States.spawning,
        states: {
          [States.spawning]: {
            /**
             * TODO: remove spawning, use invoke at top level instead
             */
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
            /**
             * SEND event MUST be only send from child.idle
             *  because it will drop the current message and dequeue the next one
             */
            entry: [
              actions.log('states.child.idle.entry', 'Mailbox'),
              actions.send(_ => Events.SEND(States.idle)),
            ],
            on: {
              [Types.BUSY]: States.busy,
              [Types.MESSAGE]: {
                actions: [
                  actions.send(_ => Events.SEND(Types.MESSAGE)),
                ],
              },
            },
          },
          [States.busy]: {
            entry: actions.log((_, e) => 'states.child.busy.entry ' + (e as ReturnType<typeof Events.BUSY>).payload.info, 'Mailbox'),
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
                actions: contexts.assignEvent,
              },
            },
          },
          [States.deadLetter]: {
            entry: [
              actions.log((_, e) => `states.router.deadLetter.entry ${e.type}`, 'Mailbox'),
              actions.send(ctx => Events.DEAD_LETTER(
                contexts.currentEvent(ctx)!,
                'dead letter',
              )),
            ],
            always: States.idle,
            exit: contexts.assignEventNull,
          },
          [States.routing]: {
            entry: [
              actions.log((_, e, { _event }) => `states.router.routing.entry event: ${e.type}@${_event.origin || ''}`, 'Mailbox'),
              actions.log(ctx => `states.router.routing.entry ctx.event: ${contexts.currentEventType(ctx)}@${contexts.currentEventOrigin(ctx)}`, 'Mailbox'),
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
                cond: ctx => {
                  console.info(`Mailbox states.router.routing.always [expr] context.event: ${contexts.currentEventType(ctx)}@${contexts.currentEventOrigin(ctx)}`)
                  /**
                   * always `false` for log only
                   *
                   * TODO: any better way for logging?
                   */
                  return false
                },
                actions: [],
              },
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
                target: States.idle,
              },
              {
                /**
                 *  2. Paracrine signalling from child machine
                 */
                cond: ctx => contexts.condCurrentEventOriginIsChild(ctx),
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
              actions.send(ctx => Events.MESSAGE(contexts.currentEventType(ctx))),
            ],
            always: States.idle,
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
            always: States.idle,
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
