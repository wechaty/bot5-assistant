import {
  Message,
  types,
}             from 'wechaty'
import {
  fromEvent,
  from,
  of,
  EMPTY,
}             from 'rxjs'
import {
  mergeMap,
}             from 'rxjs/operators'

import {
  Intent,
  textToIntents,
}                 from '../machines/message-to-intents.js'

import * as events  from './events.js'

const roomMessage$ = (message: Message) => fromEvent<Message>(message.wechaty, 'message').pipe(
  mergeMap(m => {
    if (m.self()) {
      return EMPTY
    }

    const room = m.room()
    if (!room || room.id !== message.room()?.id) {
      return EMPTY
    }

    return of(m)
  }),
)

const messageToEvent = async (message: Message) => {
  const msgType = message.type()

  const intentList: Intent[] = []
  let entities = {}

  switch (msgType) {
    case types.Message.Text:
      intentList.push(
        ...await textToIntents(
          await message.mentionText(),
        ),
      )
      entities = {
        mentionContacts: await message.mentionList(),
      }
      break

    default:
      break
  }

  return {
    entities,
    intents: intentList,
    message,
    type: events.MESSAGE,
  }
}

const messageEvent$ = (message: Message) => roomMessage$(message).pipe(
  mergeMap(m => from(messageToEvent(m))),
)

export {
  messageEvent$,
}
