/* eslint-disable sort-keys */
/**
 * Finite State Machine for BOT Friday Club Meeting
 *  @link https://github.com/wechaty/bot5-assistant
 */
import { createMachine, actions }   from 'xstate'
import { isActionOf }               from 'typesafe-actions'
import * as CQRS                    from 'wechaty-cqrs'
import * as Mailbox                 from 'mailbox'

import {
  events,
  states,
  types,
}                           from '../schemas/mod.js'
import { InjectionToken }   from '../ioc/tokens.js'

interface Context {
  conversationId?: string,
}

function initialContext (): Context {
  const context: Context = {
    conversationId: undefined,
  }
  return JSON.parse(JSON.stringify(context))
}

const EVENTS = {
  NOTICE       : events.notice,
  CONVERSATION : events.conversation,
}

type Event = ReturnType<typeof EVENTS[keyof typeof EVENTS]>

const MACHINE_NAME = 'ConversationMachine'

const machineFactory = (
  wechatyAddress: Mailbox.Address,
) => createMachine<Context, Event>({
  id: MACHINE_NAME,
  context: () => initialContext(),
  initial: states.initializing,
  states: {
    [states.initializing]: {
      always: states.idle,
    },
    [states.idle]: {
      on: {
        '*': {
          actions: actions.forwardTo(String(wechatyAddress)),
          target: states.idle,  // enforce external transition
        },
        [types.NOTICE]: states.noticing,
        [types.CONVERSATION]: {
          actions: [
            actions.log((_, e) => `states.idle.on.CONVERSATION ${e.payload.conversationId}`, MACHINE_NAME),
            actions.assign({
              conversationId: (_, e) => e.payload.conversationId,
            }),
          ],
          target: states.idle,  // enforce external transition
        },
      },
    },
    [states.noticing]: {
      entry: [
        actions.log('states.noticing.entry', MACHINE_NAME),
        wechatyAddress.send((ctx, e) =>
          isActionOf(EVENTS.NOTICE, e) && ctx.conversationId
            ? CQRS.commands.SendMessageCommand(
              CQRS.uuid.NIL,
              ctx.conversationId,
              CQRS.sayables.text(
                `【信使系统】${e.payload.notice}`,
              ),
            )
            : events.nop(),
        ),
      ],
      always: states.idle,
    },
  },
})

mailboxFactory.inject = [
  InjectionToken.Logger,
  InjectionToken.WechatyMailbox,
] as const

function mailboxFactory (
  logger: Mailbox.Options['logger'],
  wechatyMailbox: Mailbox.Interface,
) {
  const machine = machineFactory(wechatyMailbox.address)

  const mailbox = Mailbox.from(machine, { logger })
  return mailbox
}

export {
  type Context,
  machineFactory,
  mailboxFactory,
  EVENTS as Events,
}
