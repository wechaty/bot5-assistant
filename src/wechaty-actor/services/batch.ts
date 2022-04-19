import { isActionOf }             from 'typesafe-actions'
import type { AnyEventObject }    from 'xstate'

import duckula   from '../duckula.js'

import { execute } from './execute.js'

export const batch = async (
  ctx: ReturnType<typeof duckula.initialContext>,
  e: AnyEventObject,
) => {

  if (!isActionOf(duckula.Event.BATCH, e)) {
    throw new Error(`${duckula.id} service.batch: unknown event [${e.type}]`)
  }

  return Promise.all(
    e.payload.commandQueryList
      .map(commandQuery =>
        execute(
          ctx,
          duckula.Event.EXECUTE(commandQuery),
        ),
      ),
  )

}
