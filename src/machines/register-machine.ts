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
  members: Contact[]
  chairs: Contact[]
}

type Event =
  | ReturnType<typeof Events.MESSAGE>
  | ReturnType<typeof Events.MENTIONS>
  | ReturnType<typeof Events.NO_MENTION>

const registerMachine = createMachine<Context, Event>(
  {
    initial: 'start',
    context: {
      message: null,
      members: [],
      chairs: [],
    },
    states: {
      start: {
        entry: ['introduceSession'],
        always: {
          target: 'registering',
        },
      },
      registering: {
        on: {
          [Types.MESSAGE]: {
            actions: 'saveMessage',
            target: 'mentioning',
          },
        },
      },
      mentioning: {
        invoke: {
          src: 'getMentions',
          onDone: {
            target: 'finish',
            actions: [
              'saveMentions',
            ],
          },
          onError: {
            target: 'start',
            actions: ['introduceMention'],
          },
        },
      },
      finish: {
        entry: ['announceRegisteredMembers'],
        type: 'final',
        data: ctx => ctx.members,
      },
    },
  },
  {
    actions: {
      saveMessage: actions.assign({
        message:  (_, e) => (e as ReturnType<typeof Events.MESSAGE>).payload.message,
      }) as any,
      saveMentions: actions.assign({
        members: (_, e)  => (e as any).data as Contact[],
      }) as any,
      announceRegisteredMembers: ctx => ctx.message?.room()?.say('Registered members: ', ...ctx.members),
      introduceMention: ctx => ctx.message?.room()?.say('Please mention someone to register.'),
      introduceSession: ctx => ctx.message?.room()?.say('Register all members by mention them in one messsage.', ...ctx.chairs),
    },
    services: {
      getMentions: async context => {
        const mentionList = context.message && await context.message.mentionList()
        if (!mentionList || mentionList.length <= 0) {
          throw new Error('NO_MENTION')
        }
        return mentionList
      },
    },
  },
)

const registerActor = Mailbox.actor(registerMachine)

export {
  registerMachine,
  registerActor,
}
