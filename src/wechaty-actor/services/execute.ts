import { isActionOf }           from 'typesafe-actions'
import * as CQRS                from 'wechaty-cqrs'
import { firstValueFrom }       from 'rxjs'
import type { AnyEventObject }  from 'xstate'

import duckula   from '../duckula.js'

export const execute = async (
  ctx: ReturnType<typeof duckula.initialContext>,
  e: AnyEventObject,
) => {
  if (!isActionOf(duckula.Event.EXECUTE, e)) {
    throw new Error(`${duckula.id} service.execut: unknown event [${e.type}]`)
  }

  const cq = e.payload.commandQuery

  if (ctx.puppetId) {
    if (cq.meta.puppetId !== ctx.puppetId && cq.meta.puppetId !== CQRS.uuid.NIL) {
      throw new Error(`${duckula.id} services.execute() puppetId mismatch. (given: "${cq.meta.puppetId}", expected: "${ctx.puppetId}")`)
    }

    cq.meta.puppetId = ctx.puppetId

  } else {  // no puppetId in context
    if (!cq.meta.puppetId || cq.meta.puppetId === CQRS.uuid.NIL) {
      throw new Error(`${duckula.id} services.execute() puppetId missing. (no puppetId in context, and given: "${cq.meta.puppetId}")`)
    }
  }

  return firstValueFrom(
    CQRS.execute$(ctx.bus$)(cq),
  )
}
