/* eslint-disable sort-keys */
import {
  actions,
  createMachine,
}                   from 'xstate'
import {
  isActionOf,
}                   from 'typesafe-actions'
import { log }      from 'wechaty-puppet'
import type {
  Wechaty,
}                   from 'wechaty'

import {
  Events,
  States,
  Types,
}                     from '../schemas/mod.js'
import * as Mailbox   from '../mailbox/mod.js'

interface Context {
  wechaty: null | Wechaty
}

type Event =
  | ReturnType<typeof Events.MESSAGE>
  | ReturnType<typeof Events.START>
  | ReturnType<typeof Events.STOP>
  | ReturnType<typeof Events.ABORT>
  | ReturnType<typeof Events.RESET>
  | ReturnType<typeof Events.WECHATY>
  | ReturnType<typeof Events.SAY>

// const isText  = (message?: Message) => !!(message) && message.type() === WechatyTypes.Message.Text
// const isAudio = (message?: Message) => !!(message) && message.type() === WechatyTypes.Message.Audio

/**
 * use JSON.parse() to prevent the initial context from being changed
 */
function initialContext (): Context {
  const context: Context = {
    wechaty: null,
  }
  return JSON.parse(JSON.stringify(context))
}

const wechatyMachine = createMachine<Context, Event>({
  context: initialContext(),
  initial: States.initializing,
  states: {
    [States.initializing]: {
      always: States.inactive,
    },
    [States.inactive]: {
      entry: [
        actions.log('state.inactive', 'wechatyActor'),
        Mailbox.Actions.sendParentIdle('wechatyActor.inactive'),
      ],
      on: {
        [Types.WECHATY]: {
          actions: [
            actions.log((_, e) => `state.inactive.on.WECHATY wechaty id ${(e as ReturnType<typeof Events.WECHATY>).payload.wechaty.id}`, 'wechatyActor'),
            actions.assign({
              wechaty: (_, e) => (e as ReturnType<typeof Events.WECHATY>).payload.wechaty,
            }),
          ],
          target: States.inactive,
        },
        [Types.START]: {
          actions: [
            actions.log((_, __, { _event }) => 'Types.START: start with origin:' + _event.origin, 'wechatyActor'),
          ],
          target: States.validating,
        },
        [Types.RESET]: {
          actions: actions.assign(initialContext()) as any,
          target: States.inactive,
        },
      },
    },
    [States.validating]: {
      always: [
        {
          cond: ctx => !(ctx.wechaty),
          target: States.aborting,
          actions: actions.log('state.validating.always no ctx.wechaty fond', 'wechatyActor'),
        },
        {
          target: States.active,
          actions: actions.log('state.validating.always wechaty is valid', 'wechatyActor'),
        },
      ],
    },
    [States.aborting]: {
      entry: [
        actions.log('state.aborting.entry aborting', 'wechatyActor'),
        Mailbox.Actions.reply(Events.ABORT('wechaty actor failed validating: aborted')),
      ],
      always: States.inactive,
    },
    [States.active]: {
      entry: [
        actions.log('state.active.entry', 'wechatyActor'),
        Mailbox.Actions.sendParentIdle('wechatyActor.active'),
      ],
      on: {
        [Types.STOP]: States.inactive,
      },
      initial: States.idle,
      states: {
        [States.idle]: {
          entry: Mailbox.Actions.sendParentIdle('wechaty'),
          on: {
            [Types.SAY]: States.busy,
          },
        },
        [States.busy]: {
          entry: [
            actions.log((_, e) => `states.active.busy.entry ${e.type}`, 'WechatyActor'),
          ],
          invoke: {
            src: async (ctx, e) => {
              log.verbose('WechatyActor', 'state.active.busy.invoke %s', e.type)

              if (!ctx.wechaty) {
                throw new Error('WechatyActor: no ctx.wechaty')
              }

              if (isActionOf(Events.SAY, e)) {
                await ctx.wechaty.puppet.messageSendText(
                  e.payload.conversation,
                  e.payload.text,
                  e.payload.mentions,
                )
              } else {
                log.error('WechatyActor', 'state.active.busy.invoke unknown event type: %s', e.type)
              }
            },
            onDone: States.idle,
          },
        },
      },
    },
  },
})

const wechatyActor = Mailbox.address(wechatyMachine)

export {
  wechatyActor,
  wechatyMachine,
  initialContext,
}
