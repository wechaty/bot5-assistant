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
      queue: {
        /**
         * queue states transitions are all SYNC
         */
        initial: States.standby,
        on: {
          '*': {
            actions: actions.choose([
              {
                /**
                 * Skipp:
                 *  1. Mailbox.Types.* is system messages, skip them
                 *  2. Child events (origin from child machine) are handled by child machine, skip them
                 *
                 * Incoming messages: add them to queue by wrapping the `_event.origin` meta data
                 */
                cond: (_, e, meta) => true
                  && !isMailboxType(e.type)
                  && !contexts.condEventSentFromChild(meta), // condRoutingEventOriginIsChild(ctx, state.children),
                actions: [
                  actions.log((_, e, { _event }) => `states.queue.on.* contexts.assignEnqueue ${e.type}@${_event.origin || ''}`, 'Mailbox') as any,
                  contexts.assignEnqueue,
                  actions.send((_, e) => Events.NEW_MESSAGE(e.type)),
                ],
              },
            ]),
          },
        },
        states: {
          [States.standby]: {
            entry: [
              actions.log('states.queue.standby.entry', 'Mailbox'),
            ],
            on: {
              [Types.DISPATCH]: States.checking,
            },
          },
          [States.checking]: {
            entry: [
              actions.log((_, e) => 'states.queue.checking.entry ' + (e as ReturnType<typeof Events.DISPATCH>).payload.info, 'Mailbox'),
            ],
            always: [
              {
                cond: ctx => contexts.queueSize(ctx) > 0,
                actions: [
                  actions.log(ctx => `states.queue.checking.always queue size ${contexts.queueSize(ctx)}, transition to dequeuing`, 'Mailbox'),
                ],
                target: States.dequeuing,
              },
              {
                actions: actions.log('states.queue.checking.always queue is empty, transition to standby', 'Mailbox'),
                target: States.standby,
              },
            ],
          },
          [States.dequeuing]: {
            entry: [
              actions.log(ctx => `states.queue.dequeuing.entry ${contexts.queueMessageType(ctx)}@${contexts.queueMessageOrigin(ctx)}`, 'Mailbox'),
              actions.send(ctx => Events.DEQUEUE(contexts.queueMessage(ctx)!)),
              // contexts.sendCurrentMessageToChild,
            ],
            exit: [
              contexts.assignDequeue,
              actions.choose([
                {
                  cond: ctx => contexts.queueSize(ctx) <= 0,
                  actions: contexts.assignEmptyQueue,
                }
              ]),
            ],
            always: States.standby,
          },
        },
      },
      child: {
        initial: States.idle,
        on: {
          /**
           * No matter idle or busy: the child may send reponse message at any time.
           */
          [Types.CHILD_RESPOND]: {
            actions: [
              contexts.sendChildResponse,
            ],
          },
        },
        states: {
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
              [Types.DEQUEUE]: {
                actions: [
                  actions.log((_, e) => `states.child.idle.on.DEQUEUE ${(e as ReturnType<typeof Events.DEQUEUE>).payload.message.type}@${contexts.metaOrigin((e as ReturnType<typeof Events.DEQUEUE>).payload.message)}`, 'Mailbox'),
                  contexts.assignChildMessage,
                ],
                target: States.busy,
              },
              [Types.NEW_MESSAGE]: {
                actions: [
                  actions.log((_, e) => `states.child.idle.on.NEW_MESSAGE ${(e as ReturnType<typeof Events.NEW_MESSAGE>).payload.info}`, 'Mailbox'),
                  actions.send(Events.DISPATCH(Types.NEW_MESSAGE)),
                ],
              },
            },
          },
          [States.busy]: {
            entry: [
              actions.log((_, e) => 'states.child.busy.entry ' + (e as ReturnType<typeof Events.DEQUEUE>).payload.message.type, 'Mailbox'),
              contexts.sendChildMessage,
            ],
            on: {
              [Types.CHILD_IDLE]: States.idle,
            },
          },
        },
      },
      // router: {
      //   initial: States.listening,
      //   states: {
      //     [States.listening]: {
      //       entry: [
      //         actions.log((_, e) => 'states.router.listening.entry ' + e.type, 'Mailbox'),
      //       ],
      //       on: {
      //         '*': {
      //           target: States.routing,
      //         },
      //       },
      //     },
      //     [States.routing]: {
      //       entry: [
      //         actions.log((_, e, { _event }) => `states.router.routing.entry event: ${e.type}@${_event.origin || ''}`, 'Mailbox'),
      //         actions.log(ctx => `states.router.routing.entry ctx.event: ${contexts.routingEventType(ctx)}@${contexts.routingEventOrigin(ctx)} ${JSON.stringify(ctx.event)}`, 'Mailbox'),
      //         contexts.assignRoutingEvent,
      //       ],
      //       /**
      //        * Proxy EVENTs rules:
      //        *  1. skip all EVENTs send from mailbox itself
      //        *  2. enqueue all EVENTs which are not sent from child machine
      //        *  3. mailbox.respond all EVENTs send from child machine
      //        *
      //        * Difference Between Autocrine and Paracrine, @Samanthi, July 29, 2018
      //        *  @see https://www.differencebetween.com/difference-between-autocrine-and-paracrine
      //        */
      //       always: [
      //         {
      //           /**
      //            * 1. Autocrine signalling from mailbox itself
      //            *
      //            * skip all EVENTs send from mailbox itself
      //            *
      //            * NOTICE: this should be placed as the first
      //            *  because the child might send MailboxType EVENTs (with child origin) which should not
      //            *    be put to `outgoing`
      //            */
      //           cond: ctx => isMailboxType(contexts.routingEventType(ctx)),
      //           actions: [
      //             actions.log(ctx => `states.router.routing.always autocrine signal: isMailboxType(${contexts.routingEventType(ctx)})`, 'Mailbox'),
      //             contexts.assignRoutingEventNull,
      //           ],
      //           target: States.listening,
      //         },
      //         {
      //           /**
      //            *  2. Paracrine signalling from child machine
      //            */
      //           cond: (ctx, _, { state }) => contexts.condRoutingEventOriginIsChild(ctx, state.children),
      //           actions: actions.log(ctx => `states.router.routing.always paracrine signal: condCurrentEventOriginIsChild(${contexts.routingEventOrigin(ctx)})`, 'Mailbox'),
      //           // target: States.outgoing,
      //           target: States.listening,
      //         },
      //         {
      //           /**
      //            * 3. Endocrine signalling from external actors
      //            *
      //            * Current event is sent from other actors (neither child nor mailbox)
      //            */
      //           actions: actions.log(ctx => `states.router.routing.always endocrine signal: ${contexts.routingEventType(ctx)}@${contexts.routingEventOrigin(ctx)}`, 'Mailbox'),
      //           target: States.incoming,
      //         },
      //       ],
      //     },
      //     [States.incoming]: {
      //       entry: [
      //         actions.log(ctx => `states.router.incoming.entry ${contexts.routingEventType(ctx)}@${contexts.routingEventOrigin(ctx)}`, 'Mailbox'),
      //         actions.send(ctx => Events.ENQUEUE(contexts.routingEvent(ctx)!)),
      //       ],
      //       always: States.listening,
      //       exit: [
      //         actions.log(_ => 'states.router.incoming.exit', 'Mailbox'),
      //         contexts.assignRoutingEventNull,
      //       ],
      //     },
      //   },
      // },
    },
  })
  return machine
}

export {
  address,
}
