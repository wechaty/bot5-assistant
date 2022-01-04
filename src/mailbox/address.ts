import { log } from 'brolog'

import type { EventObject } from "xstate"
import { registry } from 'xstate/lib/registry.js'

interface Address <TEvent extends EventObject = EventObject> {
  send (event: TEvent): void
}

class AddressImpl <TEvent extends EventObject = EventObject> implements Address<TEvent> {

  static from <TEvent extends EventObject = EventObject>(address: string): Address<TEvent> {
    return new AddressImpl<TEvent>(address)
  }

  protected constructor (
    protected _address: string,
  ) {
  }

  toString () {
    return this._address
  }

  /**
   * Send event to address
   *
   * TODO: design this API carefully
   *  1. should we allow sending event to the mailbox?
   *  2. how can we send event to the address by specifing the origin/source address?
   */
  send (event: TEvent): void {
    const interpreter = registry.get(this._address)

    if (!interpreter) {
      log.warn('Address', 'send({type: %s}) - no actor found for %s', event.type, this._address)
      // Huan(202201): TODO: send to DLQ if address not found
      return
    }

    // console.info('SENDING event', event)
    // console.info('TO interpreter', interpreter)

    interpreter.send(event)
  }

}

export {
  type Address,
  AddressImpl,
}
