/* eslint-disable sort-keys */
import { createModel }  from 'xstate/lib/model.js'

import type { Message, Contact } from 'wechaty'

import * as events from './events.js'

/**
 *
 * Huan(202112): The Actor Model here need to be improved.
 *  @see https://github.com/wechaty/bot5-assistant/issues/4
 *
 */
const registerModel = createModel(
  {
    message: undefined as undefined | Message,
    members    : [] as Contact[],
    chairs     : [] as Contact[],
  },
  {
    events: {
      MESSAGE: events.payloads.MESSAGE,
      MENTIONS: events.payloads.MENTIONS,
      NO_MENTION: events.payloads.NO_MENTION,
    },
  },
)

// type Model   = typeof registerModel
// type Context = ContextFrom<Model>
// type Event   = EventFrom<Model>

const registerMachine = registerModel.createMachine(
  {
    initial: 'start',
    states: {
      start: {
        entry: ['introduceSession'],
        always: {
          target: 'registering',
        },
      },
      registering: {
        on: {
          MESSAGE: {
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
      saveMessage: registerModel.assign({
        message:  (_, e) => e.message,
      }, 'MESSAGE') as any,
      saveMentions: registerModel.assign({
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

export {
  registerModel,
  registerMachine,
}
