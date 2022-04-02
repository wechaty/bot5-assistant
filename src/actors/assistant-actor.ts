/* eslint-disable sort-keys */
/**
 * Finite State Machine for BOT Friday Club Meeting
 *  @link https://github.com/wechaty/bot5-assistant
 */
import { createMachine, actions }   from 'xstate'

import {
  events,
  states,
  types,
}                         from '../schemas/mod.js'
import * as Mailbox       from 'mailbox'
import { InjectionToken } from '../ioc/tokens.js'

import * as Actors from './mod.js'

interface Context {
}

function initialContext (): Context {
  const context: Context = {
  }
  return JSON.parse(JSON.stringify(context))
}

const Events = {
  MESSAGE : events.message,
  REPORT  : events.report,
  MINUTE  : events.minute,
}

type Event = ReturnType<typeof Events[keyof typeof Events]>

const MACHINE_NAME = 'AssistantMachine'

const machineFactory = (
  meetingAddress : Mailbox.Address,
  noticeAddress  : Mailbox.Address,
) => createMachine<
  Context,
  Event
>({
  id: MACHINE_NAME,
  context: () => initialContext(),
  initial: states.initializing,
  states: {
    [states.initializing]: {
      always: states.idle,
    },
    [states.idle]: {
      on: {
        [types.MESSAGE]: states.processing,
        [types.REPORT]: states.reporting,
      },
    },
    [states.reporting]: {
      entry: [

      ],
    },
    [states.processing]: {
      on: {
      },
    },
    [states.meeting]: {
      entry: [
        meetingAddress.send(events.report()),
      ],
      on: {
        [types.MESSAGE]: {
          actions: [
            actions.forwardTo(String(meetingAddress)),
          ],
        },
        [types.MINUTE]: states.finished,
      },
    },
    [states.finished]: {
      entry: [
        actions.log('states.finished.entry', MACHINE_NAME),
        noticeAddress.send(ctx =>
          Actors.notice.Events.NOTICE(
            `【Friday系统】会议简报已生成：\nTODO: ${ctx}`,
          ),
        ),
      ],
      always: states.idle,
    },
  },
})

mailboxFactory.inject = [
  InjectionToken.Logger,
  InjectionToken.MeetingMailbox,
] as const

function mailboxFactory (
  logger: Mailbox.Options['logger'],
  meetingMailbox: Mailbox.Interface,
  noticeMailbox: Mailbox.Interface,
) {
  const machine = machineFactory(
    meetingMailbox.address,
    noticeMailbox.address,
  )

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
