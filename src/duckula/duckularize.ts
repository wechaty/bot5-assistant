/* eslint-disable sort-keys */
/* eslint-disable no-redeclare */
import {
  ActionCreator,
  ActionCreatorTypeMetadata,
  getType,
}                               from 'typesafe-actions'
import type { Optional }        from 'utility-types'

import { selector }                   from './selector.js'
import type { DuckularizeOptions }    from './duckularize-options.js'
import type * as D                    from './duckula.js'

export function duckularize <
  TID extends string,

  TType extends string,
  TEventKey extends string,
  TEvent extends D.Event<TEventKey, TType>,

  TStateKey extends string,
  TStateVal extends string,
  TState extends D.State<TStateKey, TStateVal>,

  TContext extends {},
> (
  options: DuckularizeOptions<TID, TType, TEventKey, TEvent, TStateKey, TStateVal, TState, TContext>,
) {

  /**
   * Huan(202204) make TypeScript overload happy for `selector()`
   * TODO: how to fix it? (make it clean by removing the "isArray ? : " condition)
   */
  const State = Array.isArray(options.states) ? selector(options.states) : selector(options.states)
  const Event = Array.isArray(options.events) ? selector(options.events) : selector(options.events)

  /**
   * Type
   */
  type Type = { [K in keyof typeof Event]: typeof Event[K] extends ActionCreator<infer TType> & ActionCreatorTypeMetadata<infer TType> ? TType : never }
  const Type = Object.keys(Event).reduce(
    (acc, cur) => ({
      ...acc,
      [cur]: getType(Event[cur as keyof typeof Event]),
    }),
    {},
  ) as Type

  /**
   * Huan(202204): do we need JSON parse/stringify
   *  to make sure the initial context is always unmutable?
   */
  const initialContext: () => typeof options.initialContext
    = () => JSON.parse(
      JSON.stringify(
        options.initialContext,
      ),
    )

  type Duckula = D.Duckula<TID, typeof Event, typeof State, Type, TContext>

  const duckula: Optional<Duckula, 'machine'> = ({
    ID: options.id,
    Event,
    State,
    Type,
    initialContext,
  })

  return duckula
}
