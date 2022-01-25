/* eslint-disable sort-keys */
import {
  actions,
  createMachine,
  spawn,
}                   from 'xstate'
import {
  isActionOf,
}                   from 'typesafe-actions'
import * as PUPPET from 'wechaty-puppet'
import { GError }   from 'gerror'
import {
  getPuppet,
}                       from './registry/mod.js'

import { Events } from './events.js'
import { States } from './states.js'
import { Types } from './types.js'

import * as Mailbox   from '../mailbox/mod.js'

/**
 * Huan(202201): for async action, we use `request` as the Event type because
 *  only request will be sent to the machine (internal).
 *  `success` & `failure` are only sent to external.
 */
type EventsPayload<T> = {
  [key in keyof T]: T[key] extends (...args: any) => any
    ? ReturnType<T[key]>
    : 'request' extends keyof EventsPayload<T[key]>
      ? EventsPayload<T[key]>['request']
      : never
}

type Event = EventsPayload<typeof Events>[
  keyof EventsPayload<typeof Events>
]

interface Context {
  // to be added
}

/**
 * use JSON.parse() to prevent the initial context from being changed
 */
function initialContext (): Context {
  const context: Context = {
    // to be added
  }
  return JSON.parse(JSON.stringify(context))
}

const MACHINE_NAME = 'WechatyMachine'

const machineFactory = (
  logger?: Mailbox.Options['logger'],
) => createMachine<Context, Event>({
  id: MACHINE_NAME,
  context: initialContext(),
  preserveActionOrder: true,
  initial: States.initializing,
  on: {
    [Types.RESET]:        States.resetting,
    [Types.EVENT_ERROR]:  States.erroring,
  },
  states: {
    [States.initializing]: {
      entry: [
        actions.log('states.initializing.entry'),
      ],
      always: States.idle,
    },
    [States.resetting]: {
      entry: [
        actions.log('states.resetting.entry'),
        actions.assign(_ => initialContext()),
      ],
      always: States.initializing,
    },
    [States.erroring]: {
      entry: Mailbox.Actions.reply((_, e) => Events.errorEvent(e),
      always: States.idle,
    },
    [States.idle]: {
      entry: [
        actions.log('state.idle.entry', MACHINE_NAME),
        Mailbox.Actions.idle(MACHINE_NAME)('idle'),
      ],
      on: {
        '*': States.idle, // must have a external transition for all events
        [Types.SAY_REQUEST]          : Types.SAY_REQUEST,
        [Types.CURRENT_USER_REQUEST] : Types.CURRENT_USER_REQUEST,
      },
    },
    [Types.SAY_REQUEST]: {
      entry: [
        actions.log((_, e) => `state.SAY_REQUEST.entry <- [${e.type}]`, MACHINE_NAME),
      ],
      invoke: {
        src: async (_, event) => {
          if (!isActionOf(Events.say.request)(event)) {
            return Events.nop()
          }
          const messageId = await getPuppet(event.payload.puppetId)?.messageSend(
            event.payload.conversationId,
            event.payload.sayable,
          )
          if (!messageId) {
            return Events.nop()
          }
          return Events.say.success(
            event.payload.id,
            messageId,
          )
        },
        onDone: {
          actions: [
            Mailbox.Actions.reply((_, e) => e),
          ],
          target: States.idle,
        },
        onError: {
          target: States.erroring,
        },
      },
    },
    [Types.CURRENT_USER_REQUEST]: {
      entry: [
        actions.log((_, e) => `state.CURRENT_USER_REQUEST.entry <- [${e.type}]`, MACHINE_NAME),
      ],
      invoke: {
        src: async (_, event) => {
          if (!isActionOf(Events.currentUser.request)(event)) {
            return Events.nop()
          }
          const contactId = await getPuppet(event.payload.puppetId)?.currentUserId
          return Events.currentUser.success(
            event.payload.id,
            contactId,
          )
        },
        onDone: {
          actions: [
            Mailbox.Actions.reply((_, e) => e),
          ],
        },
        onError: {
          actions: actions.send((ctx, e) => Events.errorEvent(ctx.puppetId, GError.stringify(e.data))),
        },
      },
      always: States.idle,
    },
  },
})

function mailboxFactory (
  logger?: Mailbox.Options['logger'],
) {
  const machine = machineFactory(logger)
  const mailbox = Mailbox.from(machine, { logger })

  mailbox.acquire()
  return mailbox
}

export {
  machineFactory,
  mailboxFactory,
  Events,
  initialContext,
}
