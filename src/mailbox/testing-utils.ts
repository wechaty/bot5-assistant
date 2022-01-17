/* eslint-disable no-redeclare */
interface DebugPayload {
  debug?: string
}

function stripPayloadDebug (event: Object): Object
function stripPayloadDebug (eventList: Object[]): Object[]

function stripPayloadDebug (
  event: Object | Object[],
): Object | Object[] {
  if (Array.isArray(event)) {
    return event.map(e => stripPayloadDebug(e))
  }

  if ('payload' in event && 'debug' in event['payload']) {
    (event['payload'] as any).debug = undefined
  }

  return event
}

export {
  stripPayloadDebug,
}
