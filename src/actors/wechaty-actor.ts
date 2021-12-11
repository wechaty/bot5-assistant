/* eslint-disable sort-keys */
import {
  actions,
  AnyEventObject,
  createMachine,
  SCXML,
}                       from 'xstate'
import {
  isActionOf,
  // createAsyncAction,
}                         from 'typesafe-actions'

import type {
  Wechaty,
}                       from 'wechaty'

import {
  events,
  states,
  types,
}           from '../schemas/mod.js'

import * as mailbox   from './actor-mailbox.js'
import type { DeepReadonly } from 'utility-types'

interface Context extends mailbox.Context {
  wechaty: null | Wechaty
}

/**
 * Huan(202112): The Typestate feature is for state.matches(...),
 *    and not yet for within the state machine.
 *    That's something we're going to work on for V5.
 *  @see https://github.com/statelyai/xstate/issues/1138#issuecomment-615435171
 */
type Typestate =
  | {
    value: typeof states.active,
    context: Context & {
      wechaty: Wechaty,
    },
  }

type Event =
  | ReturnType<typeof events.MESSAGE>
  | ReturnType<typeof events.START>
  | ReturnType<typeof events.STOP>
  | ReturnType<typeof events.ABORT>
  | ReturnType<typeof events.RESET>
  | ReturnType<typeof events.WAKEUP>
  | ReturnType<typeof events.WECHATY>
  | ReturnType<typeof events.SAY>

// const isText  = (message?: Message) => !!(message) && message.type() === WechatyTypes.Message.Text
// const isAudio = (message?: Message) => !!(message) && message.type() === WechatyTypes.Message.Audio

// const nextEvent = (ctx: Context) => ctx.attendees.filter(c => !Object.keys(ctx.feedbacks).includes(c.id))[0]

/**
 * use JSON.parse() to prevent the initial context from being changed
 */
const initialContext: () => Context = () => ({
  ...JSON.parse(JSON.stringify(mailbox.context)),
  // -------
  wechaty: null,
})

const wechatyActor = createMachine<Context, Event, Typestate>(
  {
    context: initialContext(),
    initial: states.inactive,
    on: [
      {
        event: types.RESET,
        target: states.resetting,
      },
      /**
       * Forbidden transitions
       *  @see https://xstate.js.org/docs/guides/transitions.html#forbidden-transitions
       */
      {
        event: types.WAKEUP,
        target: undefined,
      },
      {
        event: types.ABORT,
        target: undefined,
      },
      {
        event: types.START,
        target: undefined,
      },
      {
        event: '*',
        actions: [
          mailbox.enqueue,
          actions.send(events.WAKEUP()),
        ],
      },
    ],
    states: {
      [states.inactive]: {
        entry: actions.log('inactive', 'wechatyActor'),
        on: {
          [types.WECHATY]: {
            actions: [
              // actions.log((_, e) => `set WECHATY: ${e.payload.wechaty}`, 'wechatyActor'),
              actions.assign({
                wechaty: (_, e) => e.payload.wechaty,
              }),
            ],
          },
          [types.START]: {
            actions: [
              actions.log((_, __, { _event }) => 'types.START: start with origin:' + _event.origin, 'wechatyActor'),
              /**
               * Set the origin from START event
               */
              mailbox.setCurrent,
            ],
            target: states.validating,
          },
          /**
           * Forbidden `WAKEUP` transition with `inactive` state
           * @see https://xstate.js.org/docs/guides/transitions.html#forbidden-transitions
           */
          [types.WAKEUP]: undefined,
        },
      },
      [states.validating]: {
        always: [
          {
            cond: ctx => !(ctx.wechaty),
            target: states.aborting,
            actions: actions.log('wechaty is not ready', 'wechatyActor'),
          },
          {
            target: states.active,
            actions: actions.log('wechaty is ready', 'wechatyActor'),
          },
        ],
      },
      [states.aborting]: {
        // FIXME: respond here will only work as expected with xstate@5
        entry: [
          actions.log('aborting', 'wechatyActor'),
          mailbox.respond(events.ABORT('wechaty actor failed validating: aborted')),
        ],
        always: states.inactive,
      },
      [states.resetting]: {
        entry: actions.assign(initialContext()),
        always: states.inactive,
      },
      [states.active]: {
        on: {
          [types.STOP]: {
            target: states.inactive,
            actions: [
              actions.send(events.RESET('stop')),
            ],
          },
        },
        initial: states.checking,
        states: {
          [states.idle]: {
            on: {
              [types.WAKEUP]: states.checking,
            },
          },
          [states.checking]: {
            always: [
              { // new event in queue
                cond: mailbox.nonempty,
                actions: mailbox.dequeue,
                target: states.processing,
              },
              {
                actions: actions.log('no new event in queue', 'wechatyActor'),
                target: states.idle,
              },
            ],
          },
          [states.processing]: {
            invoke: {
              src: async ctx => {
                console.info('processing: ctx.mailbox.current:', ctx.mailbox.current?.type)
                const current = mailbox.current(ctx)
                if (!current) {
                  console.error('no current')
                  return
                }
                if (!ctx.wechaty) {
                  console.error('no ctx.wechaty')
                  return
                }

                if (isActionOf(events.SAY, current)) {
                  await ctx.wechaty.puppet.messageSendText(
                    current.payload.conversation,
                    current.payload.text,
                    current.payload.mentions,
                  )
                  console.info('msg sent')
                } else {
                  console.error('unknown event type: ' + current.type)
                }
              },
              onDone: states.checking,
            },
          },
        },
      },
    },
  },
  {
    actions: {},
    services: {},
  },
)

export {
  wechatyActor,
  initialContext,
}
