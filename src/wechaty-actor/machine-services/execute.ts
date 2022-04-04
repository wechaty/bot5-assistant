import { isActionOf }       from 'typesafe-actions'
import * as CQRS            from 'wechaty-cqrs'
import { firstValueFrom }   from 'rxjs'

import { MACHINE_NAME }   from '../constants.js'
import type { Context }   from '../context.js'
import type { Event }     from '../event-type.js'
import * as events        from '../events.js'

export const execute = (bus$: CQRS.Bus) => async (ctx: Context, e: Event) => {
  if (!isActionOf(events.execute, e)) {
    throw new Error(`${MACHINE_NAME} service.execut: unknown event [${e.type}]`)
  }

  const cq = e.payload.commandQuery

  if (ctx.puppetId) {
    if (cq.meta.puppetId !== ctx.puppetId && cq.meta.puppetId !== CQRS.uuid.NIL) {
      throw new Error(`${MACHINE_NAME} services.execute() puppetId mismatch. (given: "${cq.meta.puppetId}", expected: "${ctx.puppetId}")`)
    }

    cq.meta.puppetId = ctx.puppetId

  } else {  // no puppetId in context
    if (!cq.meta.puppetId || cq.meta.puppetId === CQRS.uuid.NIL) {
      throw new Error(`${MACHINE_NAME} services.execute() puppetId missing. (no puppetId in context, and given: "${cq.meta.puppetId}")`)
    }
  }

  return firstValueFrom(
    CQRS.execute$(bus$)(cq),
  )
}
