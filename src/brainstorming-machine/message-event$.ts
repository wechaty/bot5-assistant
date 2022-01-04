import * as WECHATY from 'wechaty'
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

import { Events }  from '../schemas/mod.js'

const roomMessage$ = (room?: WECHATY.Room) => !room
  ? EMPTY
  : fromEvent<WECHATY.Message>(room, 'message').pipe(
    mergeMap(msg => msg.self()
        ? EMPTY
        : of(msg),
    ),
  )

const messageToEvent = async (message: WECHATY.Message) => {
  const msgType = message.type()

  const intentList: Intent[] = []
  let entities = {}

  switch (msgType) {
    case WECHATY.types.Message.Text:
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
    type: Events.MESSAGE,
  }
}

const messageEvent$ = (message: WECHATY.Message) => roomMessage$(message.room()).pipe(
  mergeMap(m => from(messageToEvent(m))),
)

export {
  messageEvent$,
}
