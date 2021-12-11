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

import * as events  from './events.js'
import * as types   from './types.js'
import * as states  from './states.js'

/**
 *
 * Huan(202112): The Actor Model here need to be improved.
 *  @see https://github.com/wechaty/bot5-assistant/issues/4
 *
 */
type AnyEventObjectExt = AnyEventObject & {
  meta: {
    origin: SCXML.Event<AnyEventObject>['origin']
  }
}

interface Mailbox {
  currentEvent: null | AnyEventObjectExt,
  events: AnyEventObjectExt[],
}

interface Context extends Mailbox {
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

const initialContext: Context = {
  currentEvent : null,
  events       : [],
  // -------
  wechaty        : null,
}

const wechatyActor = createMachine<Context, Event, Typestate>(
  {
    context: initialContext,
    initial: states.inactive,
    // on: {
    //   [types.RESET]: states.resetting,
    //   [types.ABORT]: undefined,
    //   '*': {
    //     actions: [
    //       actions.log((_, e) => '*[' + e.type + ']', 'wechatyActor'),
    //       actions.assign({
    //         events: (ctx, e, { _event }) => [
    //           ...ctx.events,
    //           {
    //             ...e,
    //             meta: {
    //               origin: _event.origin,
    //             },
    //           },
    //         ],
    //       }),
    //       actions.send(events.WAKEUP()),
    //     ],
    //   },
    // },
    on: [
      {
        event: types.RESET,
        target: states.resetting,
      },
      {
        event: types.WAKEUP,
        target: undefined,
      },
      {
        event: types.ABORT,
        target: undefined,
      },
      {
        event: '*',
        actions: [
          actions.assign({
            events: (ctx, e, { _event }) => {
              // console.info('wechatyActor: events:', e.type)
              const newEvents = [
                ...ctx.events,
                {
                  ...e,
                  meta: {
                    origin: _event.origin,
                  },
                },
              ]
              // console.info('newEvents:', newEvents)
              return newEvents
            },
          }),
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
              actions.log((_, e) => `set WECHATY: ${e.payload.wechaty}`, 'wechatyActor'),
              actions.assign({
                wechaty: (_, e) => e.payload.wechaty,
              }),
            ],
          },
          [types.START]: {
            actions: actions.log('start', 'wechatyActor'),
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
          actions.respond(_ => events.ABORT('wechaty actor failed validating: aborted')),
        ],
        always: states.inactive,
      },
      [states.resetting]: {
        entry: actions.assign(initialContext),
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
                cond: ctx => {
                  // console.info('checking: ctx.events.length:', ctx.events.length)
                  return ctx.events.length > 0
                },
                actions: actions.assign({
                  currentEvent: ctx => ctx.events.shift()!,
                }),
                target: states.processing,
              },
              {
                actions: actions.log('no new event in queue', 'wechatyActor'),
                target: states.idle,
              },
            ],
          },
          [states.processing]: {
            entry: [
              async ctx => {
                // console.info('processing: ctx.currentEvent:', ctx.currentEvent)
                if (!ctx.currentEvent) {
                  console.error('no ctx.currentEvent')
                  return
                }
                if (!ctx.wechaty) {
                  console.error('no ctx.wechaty')
                  return
                }

                if (isActionOf(events.SAY, ctx.currentEvent)) {
                  await ctx.wechaty.puppet.messageSendText(
                    ctx.currentEvent.payload.conversation,
                    ctx.currentEvent.payload.text,
                    ctx.currentEvent.payload.mentions,
                  )
                } else {
                  console.error('unknown event type: ' + ctx.currentEvent.type)
                }
              },
            ],
            always: states.checking,
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
}
