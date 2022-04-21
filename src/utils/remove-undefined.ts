export function removeUndefined <T extends any> (value: T, ..._args: any[]): value is Exclude<T, undefined> {
  return !!value
}
