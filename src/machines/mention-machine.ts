/* eslint-disable sort-keys */
import { createModel }  from 'xstate/lib/model.js'

import type { Message, Contact } from 'wechaty'
import { respondLastOrigin } from './respond-last-origin.js'

const mentionModel = createModel(
  {
    lastOrigin : undefined as undefined | string,
    message     : undefined as undefined | Message,
    mentions    : [] as Contact[],
  },
  {
    events: {
      MESSAGE    : (message: Message) => ({ message }),
      NO_MENTION : ()                 => ({}),
      MENTIONS   : (mentions: Contact[]) => ({ mentions }),
    },
  },
)

const mentionMachine = mentionModel.createMachine(
  {
    initial: 'idle',
    states: {
      idle: {
        on: {
          MESSAGE: {
            actions: 'saveMessage',
            target: 'extracting',
          },
        },
      },
      extracting: {
        invoke: {
          src: 'getMentions',
          onDone: {
            target: 'extracted',
            actions: [
              'saveMentions',
            ],
          },
          onError: {
            target: 'idle',
            actions: 'sendNoMention',
          },
        },
      },
      extracted: {
        entry: 'sendMentions',
        always: 'idle',
        exit: 'clearAll',
      },
    },
  },
  {
    actions: {
      sendMentions  : respondLastOrigin(ctx => mentionModel.events.MENTIONS(ctx.mentions)) as any,
      sendNoMention : respondLastOrigin(mentionModel.events.NO_MENTION()) as any,
      //
      saveMessage: mentionModel.assign({
        message:  (_, e) => e.message,
        lastOrigin: (_, __, { _event }) => _event.origin,
      }, 'MESSAGE') as any,
      saveMentions: mentionModel.assign({
        mentions: (_, e)  => (e as any).data,
      }) as any,
      //
      clearAll: mentionModel.assign({
        lastOrigin : undefined,
        message    : undefined,
        mentions   : [],
      }) as any,
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
  mentionModel,
  mentionMachine,
}
