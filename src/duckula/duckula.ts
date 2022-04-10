import type {
  ActionCreator,
  ActionCreatorTypeMetadata,
}                                               from 'typesafe-actions'
import type { AnyStateMachine, StateMachine }   from 'xstate'

export type DuckulaType <K extends string, V extends string> = {
  [key in K]: V
}

export type DuckulaState <K extends string, V extends string> = {
  [key in K]: V
}

export type DuckulaEvent <K extends string, TType extends string> = {
  [key in K]: ActionCreator<TType> & ActionCreatorTypeMetadata<TType>
}

export interface Duckula <
  TID extends string = string,

  TEvent extends DuckulaEvent<string, string> = DuckulaEvent<string, string>,
  TState extends DuckulaState<string, string> = DuckulaState<string, string>,
  TType  extends DuckulaType<string, string> = DuckulaType<string, string>,

  TContext extends {} = {},
  TMachine extends AnyStateMachine = StateMachine<TContext, any, any, any, any, any>,
> {
  ID: TID
  Type: TType
  Event: TEvent
  State: TState
  machine: TMachine
  initialContext: () => TContext
}
