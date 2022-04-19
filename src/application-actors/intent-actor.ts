/* eslint-disable sort-keys */
import { createMachine, actions }   from 'xstate'
import * as Mailbox                 from 'mailbox'
import { isActionOf }               from 'typesafe-actions'

import * as duck            from '../duck/mod.js'
import { textToIntents }    from '../services/text-to-intents.js'

interface Context {}

const duckula = Mailbox.duckularize({
  id: 'Intent',
  events: [ duck.Event, [
    'TEXT',     // request
    'INTENTS',  // response: success
    'GERROR',   // response: error
    'IDLE',     // internal
  ] ],
  states: [ duck.State, [
    'Idle',
    'Recognizing',
    'Understanding',
    'Responding',
  ] ],
  initialContext: {} as Context,
})

const machine = createMachine<
  ReturnType<typeof duckula.initialContext>,
  ReturnType<typeof duckula.Event[keyof typeof duckula.Event]>
>({
  id: duckula.id,
  initial: duckula.State.Idle,
  context: duckula.initialContext,
  states: {
    [duckula.State.Idle]: {
      entry: [
        actions.log('states.idle.entry', duckula.id),
        Mailbox.actions.idle(duckula.id)('idle'),
      ],
      on: {
        '*': duckula.State.Idle,
        [duckula.Type.TEXT]: duckula.State.Understanding,
      },
    },
    [duckula.State.Understanding]: {
      entry: [
        actions.log((_, e) => `states.understanding.entry TEXT: "${(e as ReturnType<typeof duckula.Event['TEXT']>).payload.text}"`, duckula.id),
      ],
      invoke: {
        src: (_, e) => isActionOf(duckula.Event.TEXT, e)
          ? textToIntents(e.payload.text)
          : () => { throw new Error(`isActionOf(${e.type}) unexpected.`) },
        onDone: {
          actions: actions.send((_, e) => duckula.Event.INTENTS(e.data || [ duck.Intent.Unknown ])),
        },
        onError: {
          actions: [
            actions.log((_, e) => `states.understanding.invoke.onError: ${e.data}`, duckula.id),
            actions.send(duckula.Event.INTENTS([ duck.Intent.Unknown ])),
          ],
        },
      },
      on: {
        [duckula.Type.INTENTS]: duckula.State.Responding,
      },
    },
    [duckula.State.Responding]: {
      entry: [
        actions.log((_, e) => `states.responding.entry [${e.type}](${(e as ReturnType<typeof duckula.Event['INTENTS']>).payload.intents})`, duckula.id),
        Mailbox.actions.reply((_, e) => e),
        actions.send(duckula.Event.IDLE()),
      ],
      on: {
        [duckula.Type.IDLE]: duckula.State.Idle,
      },
    },
  },
})

duckula.machine = machine
export default duckula as Required<typeof duckula>
