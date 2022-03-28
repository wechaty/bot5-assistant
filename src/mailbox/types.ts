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
enum Types {
  /**
   * sub state types of: child
   */
  CHILD_IDLE    = 'mailbox/CHILD_IDLE',
  CHILD_REPLY = 'mailbox/CHLID_REPLY',

  /**
   * types of: debug
   */
  DEAD_LETTER = 'mailbox/DEAD_LETTER',
  RESET       = 'mailbox/RESET',

  /**
   * sub state types of: queue
   */
  NEW_MESSAGE = 'mailbox/NEW_MESSAGE',
  DEQUEUE     = 'mailbox/DEQUEUE',
  DISPATCH    = 'mailbox/DISPATCH',
}

/**
 * The default mailbox consists of two queues of messages: system messages and user messages.
 *
 * The system messages are used internally by the Actor Context to suspend and resume mailbox processing in case of failure.
 *  System messages are also used by internally to manage the Actor,
 *  e.g. starting, stopping and restarting it.
 *
 * User messages are sent to the actual Actor.
 *
 * @link https://proto.actor/docs/mailboxes/
 */
const isMailboxType = (type?: null | string): boolean => !!type && Object.values<string>(Types).includes(type)

export {
  Types,
  isMailboxType,
}
