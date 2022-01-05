import {
  EventObject,
  actions,
  AnyEventObject,
  Event,
  SendExpr,
  SendActionOptions,
  SendAction,
}                   from "xstate"

interface Address {
  send<TContext, TEvent extends EventObject, TSentEvent extends EventObject = AnyEventObject> (
    event: Event<TSentEvent> | SendExpr<TContext, TEvent, TSentEvent>,
    options?: SendActionOptions<TContext, TEvent>,
  ): SendAction<TContext, TEvent, TSentEvent>
}

class AddressImpl implements Address {

  static from (address: string): Address {
    return new AddressImpl(address)
  }

  protected constructor (
    protected _address: string,
  ) {
  }

  toString () {
    return this._address
  }

  /**
   * The same API with XState `actions.send` method, but only for the current address.
   */
  send<TContext, TEvent extends EventObject, TSentEvent extends EventObject = AnyEventObject> (
    event: Event<TSentEvent> | SendExpr<TContext, TEvent, TSentEvent>,
    options?: SendActionOptions<TContext, TEvent>,
  ): SendAction<TContext, TEvent, TSentEvent> {
    return actions.send(event, {
      ...options,
      to: this._address,
    })
  }

}

export {
  type Address,
  AddressImpl,
}
