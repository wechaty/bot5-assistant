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
import { GError }   from 'gerror'

import {
  Events,
  States,
  Types,
}                     from '../schemas/mod.js'
import { Mailbox }   from '../mailbox/mod.js'

export interface Context {
  wechaty?: Wechaty
  gerror?: string
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
    wechaty: undefined,
    gerror: undefined,
  }
  return JSON.parse(JSON.stringify(context))
}

const MACHINE_NAME = 'WechatyMachine'

const wechatyMachine = createMachine<Context, Event>({
  context: initialContext(),
  /**
   * Issue statelyai/xstate#2891:
   *  The context provided to the expr inside a State
   *  should be exactly the **context in this state**
   * @see https://github.com/statelyai/xstate/issues/2891
   */
  preserveActionOrder: true,
  initial: States.initializing,
  states: {
    [States.initializing]: {
      always: States.idle,
    },
    [States.idle]: {
      entry: [
        actions.log('state.idle', MACHINE_NAME),
        Mailbox.Actions.idle('wechatyActor.idle'),
      ],
      on: {
        [Types.WECHATY]: {
          actions: [
            actions.log((_, e) => `state.idle.on.WECHATY wechaty id ${(e as ReturnType<typeof Events.WECHATY>).payload.wechaty.id}`, MACHINE_NAME),
            actions.assign({
              wechaty: (_, e) => (e as ReturnType<typeof Events.WECHATY>).payload.wechaty,
            }),
          ],
          target: States.idle,
        },
        [Types.RESET]: {
          actions: actions.assign(initialContext()) as any,
          target: States.initializing,
        },
        [Types.SAY]: States.busy,
      },
    },
    [States.erroring]: {
      entry: Mailbox.Actions.reply(ctx => Events.ERROR(ctx.gerror!)),
      exit: actions.assign({ gerror: _ => undefined }),
      always: States.idle,
    },
    [States.busy]: {
      entry: [
        actions.log((_, e) => `state.busy.entry ${e.type}`, MACHINE_NAME),
      ],
      invoke: {
        src: async (ctx, e) => {
          log.verbose(MACHINE_NAME, 'state.busy.invoke %s', e.type)

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
            log.error(MACHINE_NAME, 'state.busy.invoke unknown event type: %s', e.type)
          }
        },
        onDone: States.idle,
        onError: {
          actions: actions.assign({
            gerror: (_, e) => GError.stringify(e.data),
          }),
          target: States.erroring,
        }
      },
    },
  },
})

export {
  wechatyMachine,
  initialContext,
}
