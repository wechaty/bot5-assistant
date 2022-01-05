/* eslint-disable sort-keys */
import * as WECHATY from 'wechaty'
import {
  createMachine,
  actions,
}                   from 'xstate'
import type { Logger } from 'brolog'

import { textToIntents } from '../machines/message-to-intents.js'

import * as Mailbox from '../mailbox/mod.js'

import {
  Events as Bot5Events,
  States,
  Types,
}                     from '../schemas/mod.js'

import { speechToText } from '../to-text/mod.js'
import { InjectionToken } from '../ioc/tokens.js'

export interface Context {
  message?: WECHATY.Message
  text?: string
  gerror?: string
}

function initialContext (): Context {
  const context: Context = {
    gerror  : undefined,
    message : undefined,
    text    : undefined,
  }
  return JSON.parse(JSON.stringify(context))
}

const Events = {
  MESSAGE: Bot5Events.MESSAGE,
} as const

type Event = ReturnType<typeof Events[keyof typeof Events]>

const MACHINE_NAME = 'IntentMachine'

function machineFactory (log: Logger) {
  const machine = createMachine<Context, Event>({
    id: MACHINE_NAME,
    initial: States.idle,
    /**
     * Issue statelyai/xstate#2891:
     *  The context provided to the expr inside a State
     *  should be exactly the **context in this state**
     * @see https://github.com/statelyai/xstate/issues/2891
     */
    preserveActionOrder: true,
    context: () => initialContext(),
    states: {
      [States.idle]: {
        entry: [
          actions.log('states.idle.entry', MACHINE_NAME),
          Mailbox.Actions.idle(MACHINE_NAME),
        ],
        on: {
          '*': States.idle,
          [Types.MESSAGE]: {
            actions: [
              actions.log('states.idle.on.MESSAGE', MACHINE_NAME),
              actions.assign({ message: (_, event) => event.payload.message })
            ],
            target: States.checking,
          },
        },
      },
      [States.checking]: {
        always: [
          {
            cond: ctx => ctx.message?.type() === WECHATY.types.Message.Text,
            actions: [
              actions.assign({ text: ctx => ctx.message?.text() }),
              actions.log('states.checking.always.MESSAGE.Text', MACHINE_NAME),
            ],
            target: States.understanding,
          },
          {
            cond: ctx => ctx.message?.type() === WECHATY.types.Message.Audio,
            actions: [
              actions.log('states.checking.always.MESSAGE.Audio', MACHINE_NAME),
            ],
            target: States.recognizing,
          },
          {
            actions: [
              actions.log((_, e) => `states.checking.always.MESSAGE is neither Text nor Audio: ${e.payload.message.type()}`, MACHINE_NAME),
            ],
            target: States.idle,
          },
        ],
      },
      [States.recognizing]: {
        entry: [
          actions.log('states.recognizing.entry', MACHINE_NAME),
        ],
        invoke: {
          src: ctx => speechToText(ctx.message?.toFileBox()),
          onDone: {
            actions: [
              actions.assign({ text: (_, event) => event.data }),
            ],
            target: States.understanding,
          },
          onError: {
            actions: [
              actions.assign({ gerror: (_, event) => event.data }),
            ],
            target: States.erroring
          }
        }
      },
      [States.understanding]: {
        entry: [
          actions.log(ctx => `states.understanding.entry ${ctx.text}`, MACHINE_NAME),
        ],
        invoke: {
          src: ctx => textToIntents(ctx.text),
          onDone: {
            actions: [
              // TODO: support entities
              Mailbox.Actions.reply((_, e) => Bot5Events.INTENTS(e.data)),
            ],
            target: States.idle,
          },
          onError: {
            actions: [
              actions.assign({ gerror: (_, event) => event.data }),
            ],
            target: States.erroring,
          },
        },
      },
      [States.erroring]: {
        entry: [
          actions.log(ctx => `states.erroring.entry ${ctx.gerror}`, MACHINE_NAME),
          Mailbox.Actions.reply(ctx => Bot5Events.ERROR(ctx.gerror!)),
        ],
        exit: [
          actions.assign({ gerror: _ => undefined }),
        ],
        always: States.idle,
      },
    },
  })
  return machine
}

mailboxFactory.inject = [
  InjectionToken.Logger,
] as const
function mailboxFactory (log: Logger) {
  const machine = machineFactory(log)
  const mailbox = Mailbox.from(machine)
  mailbox.aquire()
  return mailbox
}

export {
  machineFactory,
  mailboxFactory,
  initialContext,
  Events,
}
