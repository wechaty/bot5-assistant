import { actions } from 'xstate'

import { Events } from './events.js'

const Actions = {
  sendParentIdle: (machine: string) => actions.sendParent(Events.IDLE(machine)),
}

export {
  Actions,
}
