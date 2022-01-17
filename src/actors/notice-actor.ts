/* eslint-disable sort-keys */
/**
 * Finite State Machine for BOT Friday Club Meeting
 *  @link https://github.com/wechaty/bot5-assistant
 */
import {
  createMachine,
  actions,
}                   from 'xstate'
import { isActionOf } from 'typesafe-actions'

import * as Mailbox from '../mailbox/mod.js'
import { InjectionToken } from '../ioc/tokens.js'
import {
  Events as Bot5Events,
  States,
  Types,
}             from '../schemas/mod.js'

import * as Actors from './mod.js'

interface Context {
  conversationId?: string,
}

function initialContext (): Context {
  const context: Context = {
    conversationId: undefined,
  }
  return JSON.parse(JSON.stringify(context))
}

const Events = {
  NOTICE: Bot5Events.NOTICE,
  CONVERSATION: Bot5Events.CONVERSATION,
}

type Event = ReturnType<typeof Events[keyof typeof Events]>

const MACHINE_NAME = 'ConversationMachine'

const machineFactory = (
  wechatyAddress: Mailbox.Address,
) => createMachine<
  Context,
  Event
>({
  id: MACHINE_NAME,
  context: () => initialContext(),
  initial: States.initializing,
  states: {
    [States.initializing]: {
      always: States.idle,
    },
    [States.idle]: {
      on: {
        [Types.NOTICE]: States.noticing,
        [Types.CONVERSATION]: {
          actions: [
            actions.log((_, e) => `states.idle.on.CONVERSATION ${e.payload.conversationId}`, MACHINE_NAME),
            actions.assign({
              conversationId: (_, e) => e.payload.conversationId,
            }),
          ],
        },
      },
    },
    [States.noticing]: {
      entry: [
        actions.log('states.noticing.entry', MACHINE_NAME),
        wechatyAddress.send((ctx, e) =>
          isActionOf(Events.NOTICE, e) && ctx.conversationId
            ? Actors.wechaty.Events.SAY(
              `【信使系统】${e.payload.notice}`,
              ctx.conversationId,
            )
            : Bot5Events.NOP(),
        ),
      ],
      always: States.idle,
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
  mailbox.acquire()

  return mailbox
}

export {
  type Context,
  machineFactory,
  mailboxFactory,
  Events,
}
