/* eslint-disable sort-keys */
import { createMachine, actions }   from 'xstate'
import * as Mailbox                 from 'mailbox'
import { isActionOf }               from 'typesafe-actions'

import * as duck            from '../duck/mod.js'
import { textToIntents }    from '../services/text-to-intents.js'

interface Context {}

function initialContext (): Context {
  const context: Context = {}
  return JSON.parse(JSON.stringify(context))
}

const State = {
  Idle          : duck.State.Idle,
  Recognizing   : duck.State.recognizing,
  Understanding : duck.State.understanding,
  Responding: duck.State.responding,
} as const

const Type = {
  INTENTS: duck.Type.INTENTS,
  IDLE   : duck.Type.IDLE,
  TEXT   : duck.Type.TEXT,
} as const

const EventRequest = {
  TEXT: duck.Event.TEXT,
} as const

const EventResponse = {
  /**
   * @error
   */
  GERROR: duck.Event.GERROR,
  /**
   * @success
   */
  INTENTS: duck.Event.INTENTS,
} as const

const EventInternal = {
  IDLE: duck.Event.IDLE,
}

const Event = {
  ...EventRequest,
  ...EventResponse,
  ...EventInternal,
}

// eslint-disable-next-line no-redeclare
type Event = {
  [key in keyof typeof Event]: ReturnType<typeof Event[key]>
}

const ID = 'IntentMachine'

const machine = createMachine<Context, Event[keyof Event]>({
  id: ID,
  initial: State.Idle,
  states: {
    [State.Idle]: {
      entry: [
        actions.log('states.idle.entry', ID),
        Mailbox.actions.idle(ID)('idle'),
      ],
      on: {
        '*': State.Idle,
        [Type.TEXT]: State.Understanding,
      },
    },
    [State.Understanding]: {
      entry: [
        actions.log((_, e) => `states.understanding.entry TEXT: "${(e as Event['TEXT']).payload.text}"`, ID),
      ],
      invoke: {
        src: (_, e) => isActionOf(Event.TEXT, e)
          ? textToIntents(e.payload.text)
          : () => { throw new Error(`isActionOf(${e.type}) unexpected.`) },
        onDone: {
          actions: actions.send((_, e) => Event.INTENTS(e.data || [ duck.Intent.Unknown ])),
        },
        onError: {
          actions: [
            actions.log((_, e) => `states.understanding.invoke.onError: ${e.data}`, ID),
            actions.send(Event.INTENTS([ duck.Intent.Unknown ])),
          ],
        },
      },
      on: {
        [Type.INTENTS]: State.Responding,
      },
    },
    [State.Responding]: {
      entry: [
        actions.log((_, e) => `states.responding.entry [${e.type}](${(e as Event['INTENTS']).payload.intents})`, ID),
        Mailbox.actions.reply((_, e) => e),
        actions.send(Event.IDLE()),
      ],
      on: {
        [Type.IDLE]: State.Idle,
      },
    },
  },
})

export {
  ID,
  Type,
  Event,
  State,
  machine,
  type Context,
  initialContext,
}
