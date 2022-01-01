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
  CHILD_MACHINE_ID,
}                         from './types.js'
import { validate }       from './validate.js'

interface MailboxAddressOptions {
  id?: string
  capacity?: number
}

const address = <
  TEvent extends EventObject,
  TContext extends {},
>(
  childMachine: StateMachine<
    TContext,
    any,
    TEvent
  >,
  options?: MailboxAddressOptions,
) => {
  /**
   * when in developement mode, we will validate the childMachine
   */
  if (IS_DEVELOPMENT && !validate(childMachine)) {
    throw new Error('Mailbox.address: childMachine is not valid')
  }

  const normalizedOptions: Required<MailboxAddressOptions> = {
    id       : 'mailbox',
    capacity : Infinity,
    ...options,
  }

  // https://xstate.js.org/docs/guides/context.html#initial-context

  const machine = createMachine<
    contexts.Context,
    /**
     * add child event types to mailbox event types
     *
     * Huan(202112) TODO: remove the `TEvent['type']` and just use `TEvent`
     */
    Event | { type: TEvent['type'] }
  >({
    id: normalizedOptions.id,
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
        initial: States.listening,
        on: {
          '*': {
            actions: contexts.queueAcceptingMessageWithCapacity(normalizedOptions.capacity),
          },
        },
        states: {
          [States.listening]: {
            entry: [
              actions.log('states.queue.listening.entry', 'Mailbox'),
            ],
            on: {
              [Types.DISPATCH]: States.checking,
            },
          },
          [States.checking]: {
            entry: [
              actions.log((_, e) => 'states.queue.checking.entry ' + (e as ReturnType<typeof Events.DISPATCH>).payload.debug, 'Mailbox'),
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
                actions: actions.log('states.queue.checking.always queue is empty, transition to listening', 'Mailbox'),
                target: States.listening,
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
            always: States.listening,
          },
        },
      },
      child: {
        initial: States.idle,
        on: {
          /**
           * No matter idle or busy: the child may send reponse message at any time.
           */
          [Types.CHILD_REPLY]: {
            actions: [
              contexts.sendChildReply,
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
                  actions.log((_, e) => `states.child.idle.on.NEW_MESSAGE ${(e as ReturnType<typeof Events.NEW_MESSAGE>).payload.debug}`, 'Mailbox'),
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
    },
  })
  return machine
}

export {
  address,
}
