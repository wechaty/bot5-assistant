import type * as duckula    from './duckula.js'

export interface DuckularizeOptions <
  TID extends string,

  TType extends string,
  TEventKey extends string | never,
  TEvent extends duckula.Event<TEventKey, TType>,

  TStateKey extends string,
  TStateVal extends string,
  TState extends duckula.State<TStateKey, TStateVal>,

  TContext extends {},
> {
  id: TID
  events: TEvent | [
    TEvent,
    TEventKey[],
  ]
  states: TState | [
    TState,
    TStateKey[],
  ],
  initialContext: TContext
}
