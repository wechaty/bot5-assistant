/* eslint-disable sort-keys */
/**
 * Finite State Machine for BOT Friday Club Meeting
 *  @link https://github.com/wechaty/bot5-assistant
 */
import { createMachine } from 'xstate'

import * as Mailbox from '../mailbox/mod.js'
import { InjectionToken } from '../ioc/tokens.js'

import {
  Events as Bot5Events,
  States,
  Types,
}             from '../schemas/mod.js'

interface Context {
}

function initialContext (): Context {
  const context: Context = {
  }
  return JSON.parse(JSON.stringify(context))
}

const Events = {
  START: Bot5Events.START,
  CANCEL: Bot5Events.CANCEL,
  FINISH: Bot5Events.FINISH,
}

type Event = ReturnType<typeof Events[keyof typeof Events]>

const MACHINE_NAME = 'MeetingMachine'

const machineFactory = () => createMachine<
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
        [Types.START]: States.meeting,
      },
    },
    [States.meeting]: {
      on: {
        [Types.CANCEL]: States.idle,
        [Types.FINISH]: States.idle,
      },
    },
  },
})

mailboxFactory.inject = [
  InjectionToken.Logger,
] as const

function mailboxFactory (
  logger: Mailbox.Options['logger'],
) {
  const machine = machineFactory()

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
