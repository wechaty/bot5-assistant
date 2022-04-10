/* eslint-disable sort-keys */
/* eslint-disable no-redeclare */
import {
  ActionCreator,
  ActionCreatorTypeMetadata,
  getType,
}                               from 'typesafe-actions'

import type * as duckula    from './duckula.js'

interface DuckularizeOptions <
  TID extends string,

  TType extends string,
  TEventKey extends string,
  TEvent extends duckula.DuckulaEvent<TEventKey, TType>,

  TStateKey extends string,
  TStateVal extends string,
  TState extends duckula.DuckulaState<TStateKey, TStateVal>,

  TContext extends {},
> {
  readonly id: TID
  readonly events: [
    TEvent,
    readonly TEventKey[],
  ]
  readonly states: [
    TState,
    readonly TStateKey[],
  ],
  readonly initialContext: () => TContext
}

export const duckularize = <
  TID extends string,

  TType extends string,
  TEventKey extends string,
  TEvent extends duckula.DuckulaEvent<TEventKey, TType>,

  TStateKey extends string,
  TStateVal extends string,
  TState extends duckula.DuckulaState<TStateKey, TStateVal>,

  TContext extends {},
>(
    options: DuckularizeOptions<TID, TType, TEventKey, TEvent, TStateKey, TStateVal, TState, TContext>,
  ) => {

  /**
   * State
   */
  const states = options.states[0]
  const stateKeys = options.states[1]

  type State = { [K in TStateKey]: TState[K] }
  const State = stateKeys.reduce(
    (acc, cur) => ({
      ...acc,
      [cur]: states[cur],
    }),
    {},
  ) as State

  /**
   * Event
   */
  const events = options.events[0]
  const eventKeys = options.events[1]

  type Event = { [K in TEventKey]: TEvent[K] }
  const Event = eventKeys.reduce(
    (acc, cur) => ({
      ...acc,
      [cur]: events[cur],
    }),
    {},
  ) as Event

  /**
   * Type
   */
  type Type = { [K in TEventKey]: TEvent[K] extends ActionCreator<infer TType> & ActionCreatorTypeMetadata<infer TType> ? TType : never }
  const Type = eventKeys.reduce(
    (acc, cur) => ({
      ...acc,
      [cur]: getType(events[cur]!), // FIXME: remove `!`
    }),
    {},
  ) as Type

  return ({
    ID: options.id,
    Event,
    State,
    Type,
    initialContext: options.initialContext,
  })
}
