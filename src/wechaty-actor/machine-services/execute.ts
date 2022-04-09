import { isActionOf }           from 'typesafe-actions'
import * as CQRS                from 'wechaty-cqrs'
import { firstValueFrom }       from 'rxjs'
import type { AnyEventObject }  from 'xstate'

import * as duck  from '../duck/mod.js'

export const execute = (bus$: CQRS.Bus) => async (ctx: duck.Context, e: AnyEventObject) => {
  if (!isActionOf(duck.Event.EXECUTE, e)) {
    throw new Error(`${duck.ID} service.execut: unknown event [${e.type}]`)
  }

  const cq = e.payload.commandQuery

  if (ctx.puppetId) {
    if (cq.meta.puppetId !== ctx.puppetId && cq.meta.puppetId !== CQRS.uuid.NIL) {
      throw new Error(`${duck.ID} services.execute() puppetId mismatch. (given: "${cq.meta.puppetId}", expected: "${ctx.puppetId}")`)
    }

    cq.meta.puppetId = ctx.puppetId

  } else {  // no puppetId in context
    if (!cq.meta.puppetId || cq.meta.puppetId === CQRS.uuid.NIL) {
      throw new Error(`${duck.ID} services.execute() puppetId missing. (no puppetId in context, and given: "${cq.meta.puppetId}")`)
    }
  }

  return firstValueFrom(
    CQRS.execute$(bus$)(cq),
  )
}
