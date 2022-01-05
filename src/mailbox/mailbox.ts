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
import EventEmitter from 'events'
import type { Disposable } from 'typed-inject'

import {
  StateMachine,
  EventObject,
  Interpreter,
  interpret,
}                   from 'xstate'

import type * as contexts      from './contexts.js'
import type {
  Event,
}                         from './events.js'
import type { MailboxOptions } from './mailbox-options.js'
import {
  AddressImpl,
  type Address,
}                   from './address.js'
import {
  isMailboxType,
  Types,
}                   from './types.js'
import { wrap }     from './wrap.js'

interface Mailbox<TEvent extends EventObject = EventObject> {
  address: Address<TEvent>
  on (name: 'event', listener: (event: TEvent) => void): void
  aquire (): void
  dispose (): void
}

class MailboxImpl<TEvent extends EventObject>
  extends EventEmitter
  implements Mailbox, Disposable
{

  static from<
    TContext extends {},
    TEvent extends EventObject,
  > (
    childMachine: StateMachine<
      TContext,
      any,
      TEvent
    >,
    options?: MailboxOptions,
  ): Mailbox<TEvent> {
    const wrappedMachine = wrap(childMachine, options)
    return new this(wrappedMachine)
  }

  /**
   * XState interpreter
   */
  protected _interpreter: Interpreter<
    contexts.Context,
    any,
    Event | { type: TEvent['type'] },
    any
  >
  /**
   * Address of the Mailbox
   */
  readonly address: Address<TEvent>

  protected constructor (
    protected _wrappedMachine: StateMachine<
      contexts.Context,
      any,
      Event | { type: TEvent['type'] },
      any
    >,
  ) {
    super()
    this._interpreter = interpret(this._wrappedMachine)
    this.address      = AddressImpl.from(this._interpreter.sessionId)

    this._interpreter.onEvent(event => {
      if (/^xstate\./i.test(event.type)) {
        // 1. skip for XState system events
        return
      } else if (isMailboxType(event.type) && event.type !== Types.DEAD_LETTER) {
        // 2. skip for Mailbox system events
        return
      }
      // 3. propagate event to the Mailbox
      this.emit('event', event)
    })
  }

  /**
   * Send EVENT to the Mailbox Address
   */
  send (event: TEvent): void {
    this.address.send(event)
  }

  aquire (): void {
    this._interpreter.start()
  }

  dispose (): void {
    this._interpreter.stop()
  }
}

export {
  type Mailbox,
  MailboxImpl,
}
