import {
  EventObject,
  actions,
  AnyEventObject,
  Event,
  SendExpr,
  SendActionOptions,
  SendAction,
  GuardMeta,
  createMachine,
  interpret,
}                   from "xstate"

interface Address {
  send<TContext, TEvent extends EventObject, TSentEvent extends EventObject = AnyEventObject> (
    event: Event<TSentEvent> | SendExpr<TContext, TEvent, TSentEvent>,
    options?: SendActionOptions<TContext, TEvent>
  ): SendAction<TContext, TEvent, TSentEvent>

  condNotOrigin: () => <TContext, TEvent extends EventObject> (
    _context: TContext,
    _event: TEvent,
    meta: GuardMeta<TContext, TEvent>,
  ) => boolean
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
    /**
     * Huan(202201): Issue #11 - Race condition: Mailbox think the target machine is busy when it's not
     * @link https://github.com/wechaty/bot5-assistant/issues/11
     *
     * add a `delay:0` when sending events to put the send action to the next tick
     */
    return actions.send(event, {
      delay: 0,
      ...options,
      to: this._address,
    })
  }

  /**
   * Return true if the `_event.origin` is not the same and the Address
   */
  condNotOrigin () {
    return <TContext, TEvent extends EventObject> (
      _context: TContext,
      _event: TEvent,
      meta: GuardMeta<TContext, TEvent>,
    ) => meta._event.origin !== this._address
  }

}

const nullMachine     = createMachine<{}>({})
const nullInterpreter = interpret(nullMachine)
nullInterpreter.start()

const nullAddress: Address = {
  send: <TContext, TEvent extends EventObject, TSentEvent extends EventObject = AnyEventObject> (
    event: Event<TSentEvent> | SendExpr<TContext, TEvent, TSentEvent>,
    options?: SendActionOptions<TContext, TEvent>
  ) => actions.send(event, {
    ...options,
    to: nullInterpreter.sessionId,
  }),
  condNotOrigin: () => () => false,
}

export {
  type Address,
  AddressImpl,
  nullAddress,
  nullInterpreter,
}
