/* eslint-disable sort-keys */
import {
  createMachine,
  actions,
}                   from 'xstate'

enum States {
  idle = 'batch-events/idle',
  busy = 'batch-events/busy',
}

enum Types {
  DING = 'DING',
  DONE = 'IDLE',
  WORK = 'BUSY',
  SEND = 'SEND',
  RECV = 'RECV',
  MESSAGE = 'MESSAGE',
}

const Events = {
  DING : (i: number) => ({ type: Types.DING, i }) as const,
  BUSY: () => ({ type: Types.WORK }) as const,
  IDLE: () => ({ type: Types.DONE }) as const,
  RECV: () => ({ type: Types.RECV }) as const,
  SEND: () => ({ type: Types.SEND }) as const,
  MESSAGE: () => ({ type: Types.MESSAGE }) as const,
} as const

interface Context {
  i: number,
  queue: number[],
}
type Event =
  | ReturnType<typeof Events.DING>
  | ReturnType<typeof Events.IDLE>
  | ReturnType<typeof Events.BUSY>
  | ReturnType<typeof Events.SEND>
  | ReturnType<typeof Events.RECV>

const machine = createMachine<Context, Event>({
  type: 'parallel',
  context: {
    i: -1,
    queue: [],
  },
  states: {
    child: {
      initial: States.idle,
      states: {
        [States.idle]: {
          entry: actions.send(Events.RECV()),
          on: {
            [Types.WORK]: States.busy,
          },
        },
        [States.busy]: {
          after: {
            10: {
              target: States.idle,
              actions: [
                actions.assign({ queue: (ctx) => [
                  ...ctx.queue,
                  ctx.i,
                ]}),
              ],
            },
          },
        },
      },
    },
    queue: {
      initial: States.idle,
      states: {
        [States.idle]: {
          on: {
            [Types.DING]: {
              target: States.busy,
              actions: actions.assign({ i: (_, e) => e.i }),
            },
          },
        },
        [States.busy]: {
          entry: [
            actions.assign({ queue: ctx => [
              ...ctx.queue,
              ctx.i,
            ]}),
            actions.send(Events.MESSAGE()),
          ],
          always: States.idle,
        },
      },
    },
    router: {
      initial: States.idle,
      states: {
        [States.idle]: {
          on: {
            [Types.SEND]: States.busy,
          },
        },
        [States.busy]: {
          entry: actions.choose([
            {
              cond: ctx => ctx.queue.length > 0,
              actions: [
                actions.assign({ i: ctx => ctx.queue.shift()! }),
                actions.send(Events.MESSAGE()),
              ],
            },
          ]),
          always: States.idle,
        },
      },
    },
  },
})

export {
  machine,
  Events,
  States,
  Types,
}
