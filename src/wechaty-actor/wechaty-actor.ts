/**
 *   Wechaty Open Source Software - https://github.com/wechaty
 *
 *   @copyright 2022 Huan LI (李卓桓) <https://github.com/huan>, and
 *                   Wechaty Contributors <https://github.com/wechaty>.
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
 *
 */

/* eslint-disable sort-keys */
import type * as CQRS   from 'wechaty-cqrs'
import * as Mailbox     from 'mailbox'

import { InjectionToken } from '../ioc/tokens.js'

import { type Context, initialContext }   from './context.js'
import { factory as machineFactory }      from './machine.js'

from.inject = [
  InjectionToken.WechatyCqrsBus$,
  InjectionToken.Logger,
] as const

function from (
  bus$     : CQRS.Bus,
  puppetId : string,
  logger?  : Mailbox.Options['logger'],
) {
  const machine = machineFactory(bus$, puppetId)
  const mailbox = Mailbox.from(machine, { logger })

  return mailbox
}

export {
  type Context,
  machineFactory,
  /**
   * FIXME: standardize the name of the factory function
   */
  from as factory,
  initialContext,
}
