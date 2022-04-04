import { isActionOf }   from 'typesafe-actions'
import type * as CQRS   from 'wechaty-cqrs'

import type { Context }   from '../context.js'
import * as events        from '../events.js'
import type { Event }     from '../event-type.js'
import { MACHINE_NAME }   from '../constants.js'

import { execute } from './execute.js'

export const batch = (bus$: CQRS.Bus) => async (ctx: Context, e: Event) => {

  if (!isActionOf(events.batch, e)) {
    throw new Error(`${MACHINE_NAME} service.batch: unknown event [${e.type}]`)
  }

  return Promise.all(
    e.payload.commandQueryList
      .map(commandQuery =>
        execute(bus$)(
          ctx,
          events.execute(commandQuery),
        ),
      ),
  )

}
