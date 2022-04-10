/* eslint-disable no-redeclare */
/* eslint-disable sort-keys */
/**
 * Finite State Machine for BOT Friday Club Meeting
 *  @link https://github.com/wechaty/bot5-assistant
 */
import { createMachine, actions }   from 'xstate'

import * as duck          from '../duck/mod.js'
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

const Type = {
  MESSAGE: duck.Type.MESSAGE,
  REPORT: duck.Type.REPORT,
  MINUTE: duck.Type.MINUTE,
} as const

type Type = typeof Type[keyof typeof Type]

const Event = {
  MESSAGE : duck.Event.MESSAGE,
  REPORT  : duck.Event.REPORT,
  MINUTE  : duck.Event.MINUTE,
}

type Event = {
  [key in keyof typeof Event]: ReturnType<typeof Event[key]>
}

const State = {
  initializing: duck.State.initializing,
  idle: duck.State.Idle,
  reporting: duck.State.reporting,
  processing: duck.State.processing,
  meeting: duck.State.mentioning,
  finished: duck.State.finished,
} as const

type State = typeof State[keyof typeof State]

const MACHINE_NAME = 'AssistantMachine'

const machineFactory = (
  meetingAddress : Mailbox.Address,
  noticeAddress  : Mailbox.Address,
) => createMachine<
  Context,
  Event[keyof Event]
>({
  id: MACHINE_NAME,
  context: () => initialContext(),
  initial: State.initializing,
  states: {
    [State.initializing]: {
      always: State.idle,
    },
    [State.idle]: {
      on: {
        [Type.MESSAGE]: State.processing,
        [Type.REPORT]: State.reporting,
      },
    },
    [State.reporting]: {
      entry: [

      ],
    },
    [State.processing]: {
      on: {
      },
    },
    [State.meeting]: {
      entry: [
        meetingAddress.send(Event.REPORT()),
      ],
      on: {
        [Type.MESSAGE]: {
          actions: [
            actions.forwardTo(String(meetingAddress)),
          ],
        },
        [Type.MINUTE]: State.finished,
      },
    },
    [State.finished]: {
      entry: [
        actions.log('State.finished.entry', MACHINE_NAME),
        noticeAddress.send(ctx =>
          Actors.notice.Events.NOTICE(
            `【Friday系统】会议简报已生成：\nTODO: ${ctx}`,
          ),
        ),
      ],
      always: State.idle,
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
  return mailbox
}

export {
  type Context,
  machineFactory,
  mailboxFactory,
  Event as Events,
}
