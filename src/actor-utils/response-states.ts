/* eslint-disable sort-keys */
import { actions }      from 'xstate'
import * as Mailbox     from 'mailbox'
import { isActionOf }   from 'typesafe-actions'
import { GError }       from 'gerror'

import * as duck    from '../duck/mod.js'

/**
 * Extend the machine states to support `Responded` and `Errored` states.
 *
 *  the `Responding` and `Erroring` state can be a pre-process for preparing EVENT payloads,
 *  for example: adding linked `message` to the payload, before sending it back.
 *
 * @param id { string } - duckula.id
 * @returns { states } standard `Responded` & `Errored` states.
 */
export const responseStates = (id: string) => ({
  [duck.State.Responded]: {
    entry: [
      actions.log((_, e) => `states.Responded.entry [${e.type}]`, id),
      Mailbox.actions.reply((_, e) => e),
    ],
    always: duck.State.Idle,
  },

  [duck.State.Errored]: {
    entry: [
      actions.log<any, ReturnType<typeof duck.Event.GERROR>>(
        (_, e) => `states.Errored.entry [${e.type}] ${e.payload.gerror}`, id),
      Mailbox.actions.reply(
        (_, e) => isActionOf(duck.Event.GERROR, e)
          ? e
          : duck.Event.GERROR(GError.stringify(e))
        ,
      ),
    ],
    always: duck.State.Idle,
  },
})
