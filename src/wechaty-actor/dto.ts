import type * as CQRS from 'wechaty-cqrs'

export type CommandQuery =
  | ReturnType<typeof CQRS.commands[keyof typeof CQRS.commands]>
  | ReturnType<typeof CQRS.queries [keyof typeof CQRS.queries]>

export type ResponseEvent =
  | ReturnType<typeof CQRS.responses[keyof typeof CQRS.responses]>
  | ReturnType<typeof CQRS.events[keyof typeof CQRS.events]>
