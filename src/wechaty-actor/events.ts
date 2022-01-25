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
/* eslint-disable sort-keys */
import {
  createAction,
  createAsyncAction,
}                         from 'typesafe-actions'

import type * as PUPPET   from 'wechaty-puppet'
import * as UUID          from 'uuid'

import { Types } from './types.js'

type Sayable = PUPPET.payloads.Sayable

interface ContactIdOptions  { contactId: string }
interface ErrorOptions            { gerror: string }
interface IdOptions               { id: string }
interface MessageIdOptions        { messageId: string }
interface ConversationIdOptions   { conversationId: string }
// interface TextOptions             { text: string }
interface SayableOptions          { sayable: Sayable }

interface PuppetIdOptions  { puppetId: string }

/**
 * Register Actions
 */
const preparePuppetId   = (puppetId: string)  => ({ puppetId })
const prepareWechatyId  = (wechatyId: string) => ({ wechatyId })

const prepareWechatyPuppetId = (options: { wechatyId: string, puppetId: string }) => options

/**
 * Event Actions' Payloads
 */
const prepareStateActive   = (puppetId: string, status: true | 'pending') => ({ status, puppetId })
const prepareStateInactive = (puppetId: string, status: true | 'pending') => ({ status, puppetId })

const prepareEventDong           = (puppetId: string, payload: PUPPET.payloads.EventDong)       => ({ ...payload, puppetId })
const prepareEventError          = (puppetId: string, payload: PUPPET.payloads.EventError)      => ({ ...payload, puppetId })
const prepareEventHeartbeat      = (puppetId: string, payload: PUPPET.payloads.EventHeartbeat)  => ({ ...payload, puppetId })
const prepareEventReady          = (puppetId: string, payload: PUPPET.payloads.EventReady)      => ({ ...payload, puppetId })
const prepareEventReset          = (puppetId: string, payload: PUPPET.payloads.EventReset)      => ({ ...payload, puppetId })
const prepareEventFriendship     = (puppetId: string, payload: PUPPET.payloads.EventFriendship) => ({ ...payload, puppetId })
const prepareEventLogin          = (puppetId: string, payload: PUPPET.payloads.EventLogin)      => ({ ...payload, puppetId })
const prepareEventLogout         = (puppetId: string, payload: PUPPET.payloads.EventLogout)     => ({ ...payload, puppetId })
const prepareEventMessage        = (puppetId: string, payload: PUPPET.payloads.EventMessage)    => ({ ...payload, puppetId })
const prepareEventRoomInvitation = (puppetId: string, payload: PUPPET.payloads.EventRoomInvite) => ({ ...payload, puppetId })
const prepareEventRoomJoin       = (puppetId: string, payload: PUPPET.payloads.EventRoomJoin)   => ({ ...payload, puppetId })
const prepareEventRoomLeave      = (puppetId: string, payload: PUPPET.payloads.EventRoomLeave)  => ({ ...payload, puppetId })
const prepareEventRoomTopic      = (puppetId: string, payload: PUPPET.payloads.EventRoomTopic)  => ({ ...payload, puppetId })
const prepareEventScan           = (puppetId: string, payload: PUPPET.payloads.EventScan)       => ({ ...payload, puppetId })

const prepareData     = (puppetId: string, data: string)  => ({ data, puppetId })
// const prepareLogin    = (payload: PuppetIdOptions & PUPPET.payloads.Contact) => payload

const prepareSayRequest = (puppetId: string, conversationId: string, sayable: Sayable)  => ({ id: UUID.v4(),  puppetId, conversationId, sayable })
const prepareSaySuccess = (id: string, messageId: string)                               => ({ id,             messageId })
const prepareSayFailure = (id: string, gerror: string)                                  => ({ id,             gerror })

const prepareCurrentUserRequest = (puppetId: string)                => ({ id: UUID.v4(),  puppetId })
const prepareCurrentUserSuccess = (id: string, contactId?: string)  => ({ id,             contactId })
const prepareCurrentUserFailure = (id: string, gerror: string)      => ({ id,             gerror })

const Events = {
  /**
   * Actions: Registry
   */
  registerPuppet: createAction(Types.PUPPET_REGISTER,   preparePuppetId)(),
  deregisterPuppet: createAction(Types.PUPPET_DEREGISTER, preparePuppetId)(),

  registerWechaty: createAction(Types.WECHATY_REGISTER,   prepareWechatyId)(),
  deregisterWechaty: createAction(Types.WECHATY_DEREGISTER, prepareWechatyId)(),

  bindWechatyPuppet: createAction(Types.WECHATY_PUPPET_BIND,   prepareWechatyPuppetId)(),
  unbindWechatyPuppet: createAction(Types.WECHATY_PUPPET_UNBIND, prepareWechatyPuppetId)(),

  /**
   * Actions: StateState
   */
  activeState: createAction(Types.STATE_ACTIVE,   prepareStateActive)(),
  inactiveState: createAction(Types.STATE_INACTIVE, prepareStateInactive)(),

  /**
   * Actions: Events
   */
  dongEvent: createAction(Types.EVENT_DONG,        prepareEventDong)(),
  errorEvent: createAction(Types.EVENT_ERROR,       prepareEventError)(),
  friendshipEvent: createAction(Types.EVENT_FRIENDSHIP,  prepareEventFriendship)(),
  heartbeatEvent: createAction(Types.EVENT_HEARTBEAT,   prepareEventHeartbeat)(),
  loginEvent: createAction(Types.EVENT_LOGIN,       prepareEventLogin)(),
  logoutEvent: createAction(Types.EVENT_LOGOUT,      prepareEventLogout)(),
  messageEvent: createAction(Types.EVENT_MESSAGE,     prepareEventMessage)(),
  readyEvent: createAction(Types.EVENT_READY,       prepareEventReady)(),
  resetEvent: createAction(Types.EVENT_RESET,       prepareEventReset)(),
  roomInviteEvent: createAction(Types.EVENT_ROOM_INVITE, prepareEventRoomInvitation)(),
  roomJoinEvent: createAction(Types.EVENT_ROOM_JOIN,   prepareEventRoomJoin)(),
  roomLeaveEvent: createAction(Types.EVENT_ROOM_LEAVE,  prepareEventRoomLeave)(),
  roomTopicEvent: createAction(Types.EVENT_ROOM_TOPIC,  prepareEventRoomTopic)(),
  scanEvent: createAction(Types.EVENT_SCAN,        prepareEventScan)(),

  startEvent: createAction(Types.EVENT_START,       preparePuppetId)(),
  stopEvent: createAction(Types.EVENT_STOP,        preparePuppetId)(),

  /**
   * Actions: Void APIs
   */
  ding: createAction(Types.DING,  prepareData)(),
  reset: createAction(Types.RESET, prepareData)(),
  // login: createAction(Types.LOGIN, prepareLogin)(),

  /**
   * Actions: Non-Void APIs
   */
  say: createAsyncAction(
    [Types.SAY_REQUEST, prepareSayRequest],
    [Types.SAY_SUCCESS, prepareSaySuccess],
    [Types.SAY_FAILURE, prepareSayFailure],
  )(),

  currentUser: createAsyncAction(
    [Types.CURRENT_USER_REQUEST, prepareCurrentUserRequest],
    [Types.CURRENT_USER_SUCCESS, prepareCurrentUserSuccess],
    [Types.CURRENT_USER_FAILURE, prepareCurrentUserFailure],
  )(),

  /**
   * Bug compatible & workaround for Ducks API
   *  https://github.com/huan/ducks/issues/2
   */
  nop: createAction(Types.NOP)(),
}

export {
  Events,
}
