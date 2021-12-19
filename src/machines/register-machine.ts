/* eslint-disable sort-keys */
import {
  createMachine,
  actions,
}                 from 'xstate'

import type {
  Message,
  Contact,
}                 from 'wechaty'

import * as Mailbox from '../mailbox/mod.js'
import {
  Events,
  States,
  Types,
}                 from '../schemas/mod.js'

interface Context {
  message: null | Message
  contacts: Contact[]
  chairs: Contact[]
}

type Event =
  | ReturnType<typeof Events.MESSAGE>
  | ReturnType<typeof Events.MENTIONS>
  | ReturnType<typeof Events.NO_MENTION>
  | ReturnType<typeof Events.RESET>

const registerMachine = createMachine<Context, Event>(
  {
    initial: States.initializing,
    context: {
      message: null,
      contacts: [],
      chairs: [],
    },
    states: {
      [States.initializing]: {
        always: States.starting,
      },
      [States.starting]: {
        entry: ctx => ctx.message?.room()?.say('Register all members by mention them in one messsage.', ...ctx.chairs),
        always: States.idle,
      },
      [States.idle]: {
        entry: [
          Mailbox.Actions.sendParentIdle('register machine'),
        ],
        on: {
          [Types.MESSAGE]: {
            actions: actions.assign({ message:  (_, e) => e.payload.message }),
            target: States.checking,
          },
          [Types.RESET]: {
            actions: actions.assign({ contacts: _ => [] }),
            target: States.initializing,
          },
        },
      },
      [States.checking]: {
        invoke: {
          src: ctx => ctx.message!.mentionList(),
          onDone: {
            target: States.registered,
            actions: actions.assign({
              contacts: (ctx, e)  => [
                ...ctx.contacts,
                ...e.data,
              ],
            }),
          },
          onError: {
            target: States.busy,
            actions: ctx => ctx.message?.room()?.say('Please mention someone to register.'),
          },
        },
      },
      [States.busy]: {
        entry: actions.log('Register machine is busy.', 'RegistrMachine'),
        on: {
          [Types.MESSAGE]: {
            actions: actions.assign({ message:  (_, e) => e.payload.message }),
            target: States.checking,
          },
        },
      },
      [States.registered]: {
        entry: [
          actions.sendParent(ctx => Events.CONTACTS(ctx.contacts)),
        ],
        always: States.idle,
      },
    },
  },
)

const registerActor = Mailbox.actor(registerMachine)

export {
  registerMachine,
  registerActor,
}
