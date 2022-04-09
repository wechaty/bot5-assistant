export interface Context {
  puppetId : string
}

/**
 * use JSON.parse() to prevent the initial context from being changed
 */
export function initialContext (
  puppetId : string,
): Context {
  const context: Context = {
    puppetId,
  }
  return JSON.parse(JSON.stringify(context))
}
