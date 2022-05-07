import { of }                       from 'rxjs'
import { filter, map, mergeMap }    from 'rxjs/operators'
import * as CQRS                    from 'wechaty-cqrs'

import { isDefined } from '../../pure-functions/is-defined.js'

/**
 * Skip self message payload
 */
export const skipSelfMessagePayload$ = (bus$: CQRS.Bus) => (puppetId: string) =>
  of(CQRS.queries.GetCurrentUserIdQuery(puppetId)).pipe(
    mergeMap(CQRS.execute$(bus$)),
    map(response => response.payload.contactId),
    mergeMap(currentUserId => bus$.pipe(
      filter(CQRS.is(CQRS.events.MessageReceivedEvent)),
      map(e => CQRS.queries.GetMessagePayloadQuery(puppetId, e.payload.messageId)),
      mergeMap(CQRS.execute$(bus$)),
      map(response => response.payload.message),
      filter(isDefined),
      filter(message => message.talkerId !== currentUserId),
    )),
  )
