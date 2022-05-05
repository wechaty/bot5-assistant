/* eslint-disable sort-keys */
import { actions, AnyEventObject, EventObject }     from 'xstate'
import * as Mailbox                                 from 'mailbox'
import { isActionOf }                               from 'typesafe-actions'
import { GError }                                   from 'gerror'

import * as duck    from '../duck/mod.js'

/**
 * Extend the machine states to support `Responding` and `Erroring` states.
 *
 * send an [EVENT] or [BATCH(events)] that need to be responded to `State.Responding`
 *  - BATCH(events) will be unwrapped to individual event and resopnded to `State.Responding`
 * send GERROR that need to be responded to `State.Erroring`
 *
 * - State.Responding: respond events to the parent machine wrapped within Mailbox.Event.ACTOR_REPLY.
 * - State.Erroring: respond events to the parent machine wrapped within GERROR.
 *
 * @param id { string } - duckula.id
 * @returns { states } standard `Responding` & `Erroring` states.
 */
export const responseStates = (id: string) => ({
  [duck.State.Responding]: {
    entry: [
      actions.log((_, e) => `states.Responding.entry [${e.type}]`, id),
      actions.choose([
        {
          cond: (_, e) => isActionOf(duck.Event.BATCH, e),
          actions: [
            actions.pure<any, ReturnType<typeof duck.Event.BATCH> | AnyEventObject>(
              (_, batchEvent) => (batchEvent.payload.events as EventObject[])
                .map(singleEvent => actions.send(singleEvent)),
            ),
          ],
        },
        { actions: Mailbox.actions.reply((_, e) => e) },
      ]),
      actions.send(duck.Event.FINISH()),
    ],
    on: {
      '*': duck.State.Responding,
      [duck.Type.FINISH]: duck.State.Idle,
    },
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
