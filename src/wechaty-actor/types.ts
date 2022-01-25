/**
 *   Wechaty Open Source Software - https://github.com/wechaty
 *
 *   @copyright 2016 Huan LI (李卓桓) <https://github.com/huan>, and
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
  PUPPET_REGISTER   = 'wechaty-puppet/PUPPET_REGISTER',
  PUPPET_DEREGISTER = 'wechaty-puppet/PUPPET_DEREGISTER',

  WECHATY_REGISTER   = 'wechaty-puppet/WECHATY_REGISTER',
  WECHATY_DEREGISTER = 'wechaty-puppet/WECHATY_DEREGISTER',

  WECHATY_PUPPET_BIND   = 'wechaty-puppet/WECHATY_PUPPET_BIND',
  WECHATY_PUPPET_UNBIND = 'wechaty-puppet/WECHATY_PUPPET_UNBIND',

  STATE_ACTIVE   = 'wechaty-puppet/STATE_ACTIVE',
  STATE_INACTIVE = 'wechaty-puppet/STATE_INACTIVE',

  EVENT_DONG        = 'wechaty-puppet/EVENT_DONG',
  EVENT_ERROR       = 'wechaty-puppet/EVENT_ERROR',
  EVENT_FRIENDSHIP  = 'wechaty-puppet/EVENT_FRIENDSHIP',
  EVENT_HEARTBEAT   = 'wechaty-puppet/EVENT_HEARTBEAT',
  EVENT_LOGIN       = 'wechaty-puppet/EVENT_LOGIN',
  EVENT_LOGOUT      = 'wechaty-puppet/EVENT_LOGOUT',
  EVENT_MESSAGE     = 'wechaty-puppet/EVENT_MESSAGE',
  EVENT_READY       = 'wechaty-puppet/EVENT_READY',
  EVENT_RESET       = 'wechaty-puppet/EVENT_RESET',
  EVENT_ROOM_INVITE = 'wechaty-puppet/EVENT_ROOM_INVITE',
  EVENT_ROOM_JOIN   = 'wechaty-puppet/EVENT_ROOM_JOIN',
  EVENT_ROOM_LEAVE  = 'wechaty-puppet/EVENT_ROOM_LEAVE',
  EVENT_ROOM_TOPIC  = 'wechaty-puppet/EVENT_ROOM_TOPIC',
  EVENT_SCAN        = 'wechaty-puppet/EVENT_SCAN',

  EVENT_START       = 'wechaty-puppet/EVENT_START',
  EVENT_STOP        = 'wechaty-puppet/EVENT_STOP',

  /**
   * Wechaty APIs
   */
  DING  = 'wechaty-puppet/DING',
  RESET = 'wechaty-puppet/RESET',

  SAY_REQUEST = 'wechaty-puppet/SAY_REQUEST',
  SAY_SUCCESS = 'wechaty-puppet/SAY_SUCCESS',
  SAY_FAILURE = 'wechaty-puppet/SAY_FAILURE',

  CURRENT_USER_REQUEST = 'wechaty-puppet/CURRENT_USER_REQUEST',
  CURRENT_USER_SUCCESS = 'wechaty-puppet/CURRENT_USER_SUCCESS',
  CURRENT_USER_FAILURE = 'wechaty-puppet/CURRENT_USER_FAILURE',

  LOGIN = 'wechaty-puppet/LOGIN',

  NOP = 'wechaty-puppet/NOP',
}

export {
  Types,
}
