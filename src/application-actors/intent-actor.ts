/* eslint-disable sort-keys */
import * as WECHATY                 from 'wechaty'
import * as PUPPET                  from 'wechaty-puppet'
import * as CQRS                    from 'wechaty-cqrs'
import { createMachine, actions }   from 'xstate'
import { FileBox }                  from 'file-box'
import * as Mailbox                 from 'mailbox'

import * as ACTOR           from '../wechaty-actor/mod.js'
import * as schemas         from '../schemas/mod.js'
import { textToIntents }    from '../machines/message-to-intents.js'
import { speechToText }     from '../to-text/mod.js'
import { InjectionToken }   from '../ioc/tokens.js'

export interface Context {
  message?: PUPPET.payloads.Message
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

const states = {
  idle: schemas.states.idle,
  checking: schemas.states.checking,
  understanding: schemas.states.understanding,
  erroring: schemas.states.erroring,
  recognizing: schemas.states.recognizing,
} as const

const types = {
  MESSAGE: schemas.types.MESSAGE,
} as const

const events = {
  MESSAGE: schemas.events.MESSAGE,
  GERROR: schemas.events.GERROR,
  INTENTS: schemas.events.INTENTS,
} as const

type Event =
  | ReturnType<typeof events[keyof typeof events]>
  | ACTOR.Event

type Events = {
  [key in keyof typeof events]: ReturnType<typeof events[key]>
}

const MACHINE_NAME = 'IntentMachine'

function machineFactory (
  wechatyAddress: Mailbox.Address,
) {
  const machine = createMachine<Context, Event>({
    id: MACHINE_NAME,
    initial: states.idle,
    /**
     * Issue statelyai/xstate#2891:
     *  The context provided to the expr inside a State
     *  should be exactly the **context in this state**
     * @see https://github.com/statelyai/xstate/issues/2891
     */
    preserveActionOrder: true,
    context: () => initialContext(),
    states: {
      [states.idle]: {
        entry: [
          actions.log('states.idle.entry', MACHINE_NAME),
          Mailbox.actions.idle(MACHINE_NAME)('idle'),
        ],
        on: {
          '*': states.idle,
          [types.MESSAGE]: {
            actions: [
              actions.log('states.idle.on.MESSAGE', MACHINE_NAME),
              actions.assign({ message: (_, event) => event.payload.message }),
            ],
            target: states.checking,
          },
        },
      },
      [states.checking]: {
        always: [
          {
            cond: ctx => ctx.message?.type === PUPPET.types.Message.Text,
            actions: [
              actions.assign({ text: ctx => ctx.message?.text }),
              actions.log('states.checking.always.MESSAGE.Text', MACHINE_NAME),
            ],
            target: states.understanding,
          },
          {
            cond: ctx => ctx.message?.type === PUPPET.types.Message.Audio,
            actions: [
              actions.log('states.checking.always.MESSAGE.Audio', MACHINE_NAME),
            ],
            target: states.recognizing,
          },
          {
            actions: [
              actions.log((_, e) => `states.checking.always.MESSAGE is neither Text nor Audio: ${PUPPET.types.Message[(e as Events['MESSAGE']).payload.message.type]}`, MACHINE_NAME),
            ],
            target: states.idle,
          },
        ],
      },
      [states.recognizing]: {
        entry: [
          actions.log((_, e) => `states.recognizing.entry MessageType ${PUPPET.types.Message[(e as Events['MESSAGE']).payload.message.type]}`, MACHINE_NAME),
          wechatyAddress.send((_, e) => ACTOR.events.execute(
            CQRS.queries.GetSayablePayloadQuery(
              CQRS.uuid.NIL,
              (e as Events['MESSAGE']).payload.message.id,
            ),
          )),
        ],
        on: {
          [ACTOR.types.RESPONSE]: {
            actions: [
              actions.log((_, e) => `states.recognizing.on.RESPONSE sayable type: "${(e.payload.response as InstanceType<typeof CQRS.responses.GetSayablePayloadQueryResponse>).payload.sayable?.type}"`, MACHINE_NAME),

            ],
          },
        },
        invoke: {
          src: ctx => speechToText(FileBox.fromJSON(ctx.message?.fileBox)),
          onDone: {
            actions: [
              actions.assign({ text: (_, event) => event.data }),
            ],
            target: states.understanding,
          },
          onError: {
            actions: [
              actions.assign({ gerror: (_, event) => event.data }),
            ],
            target: states.erroring,
          },
        },
      },
      [states.understanding]: {
        entry: [
          actions.log(ctx => `states.understanding.entry ${ctx.text}`, MACHINE_NAME),
        ],
        invoke: {
          src: ctx => textToIntents(ctx.text),
          onDone: {
            actions: [
              // TODO: support entities
              Mailbox.actions.reply((_, e) => events.INTENTS(e.data)),
            ],
            target: states.idle,
          },
          onError: {
            actions: [
              actions.assign({ gerror: (_, event) => event.data }),
            ],
            target: states.erroring,
          },
        },
      },
      [states.erroring]: {
        entry: [
          actions.log(ctx => `states.erroring.entry ${ctx.gerror}`, MACHINE_NAME),
          Mailbox.actions.reply(ctx => events.GERROR(ctx.gerror!)),
        ],
        exit: [
          actions.assign({ gerror: _ => undefined }),
        ],
        always: states.idle,
      },
    },
  })
  return machine
}

mailboxFactory.inject = [
  InjectionToken.Logger,
] as const

function mailboxFactory (
  logger: Mailbox.Options['logger'],
) {
  const machine = machineFactory()

  const mailbox = Mailbox.from(machine, { logger })
  return mailbox
}

export {
  machineFactory,
  mailboxFactory,
  initialContext,
  events as Events,
}
