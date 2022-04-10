/* eslint-disable sort-keys */
/* eslint-disable no-redeclare */
import {
  ActionCreator,
  ActionCreatorTypeMetadata,
  getType,
}                               from 'typesafe-actions'
import type { Optional }        from 'utility-types'

import type * as duck    from './duckula.js'

interface DuckularizeOptions <
  TID extends string,

  TType extends string,
  TEventKey extends string,
  TEvent extends duck.Event<TEventKey, TType>,

  TStateKey extends string,
  TStateVal extends string,
  TState extends duck.State<TStateKey, TStateVal>,

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
  readonly initialContext: TContext
}

export const duckularize = <
  TID extends string,

  TType extends string,
  TEventKey extends string,
  TEvent extends duck.Event<TEventKey, TType>,

  TStateKey extends string,
  TStateVal extends string,
  TState extends duck.State<TStateKey, TStateVal>,

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

  /**
   * Huan(202204): do we need JSON parse/stringify
   *  to make sure the initial context is always unmutable?
   */
  const initialContext: () => typeof options.initialContext = () =>
    JSON.parse(
      JSON.stringify(
        options.initialContext,
      ),
    )

  type Duckula = duck.Duckula<TID, Event, State, Type, TContext>

  const duckula: Optional<Duckula, 'machine'> = ({
    ID: options.id,
    Event,
    State,
    Type,
    initialContext,
  })

  return duckula
}
