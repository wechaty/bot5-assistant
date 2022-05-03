/**
 * Generate an invoke id in an machine for make it distinct
 *
 * @param childId { string } - the id of the child actor
 * @param parentId { string } - the id of the parent actor
 * @param ids - additional ids
 * @returns generated invoke id
 */
export function invokeId (childId: string, parentId: string, ...ids: string[]) {
  return [ parentId, ...ids ].reduce((acc, id) => {
    return acc + '@' + id
  }, childId)
}
