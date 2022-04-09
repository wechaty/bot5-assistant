import { isActionOf }             from 'typesafe-actions'
import type * as CQRS             from 'wechaty-cqrs'
import type { AnyEventObject }    from 'xstate'

import * as duck   from '../duck/mod.js'

import { execute } from './execute.js'

export const batch = (bus$: CQRS.Bus) => async (ctx: duck.Context, e: AnyEventObject) => {

  if (!isActionOf(duck.Event.BATCH, e)) {
    throw new Error(`${duck.ID} service.batch: unknown event [${e.type}]`)
  }

  return Promise.all(
    e.payload.commandQueryList
      .map(commandQuery =>
        execute(bus$)(
          ctx,
          duck.Event.EXECUTE(commandQuery),
        ),
      ),
  )

}
