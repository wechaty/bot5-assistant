/* eslint-disable sort-keys */
import { actions }      from 'xstate'
import * as Mailbox     from 'mailbox'
import { isActionOf }   from 'typesafe-actions'
import { GError }       from 'gerror'

import * as duck    from '../duck/mod.js'

/**
 * Extend the machine states to support `Responding` and `Erroring` states.
 *
 * @param id { string } - duckula.id
 * @returns { states } standard `Responding` & `Erroring` states.
 */
export const responseStates = (id: string) => ({
  [duck.State.Responding]: {
    entry: [
      actions.log((_, e) => `states.Responding.entry [${e.type}]`, id),
      Mailbox.actions.reply((_, e) => e),
    ],
    always: duck.State.Idle,
  },

  [duck.State.Erroring]: {
    entry: [
      actions.log<any, ReturnType<typeof duck.Event.GERROR>>(
        (_, e) => `states.Erroring.entry [${e.type}] ${e.payload.gerror}`, id),
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
