#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/* eslint-disable sort-keys */
import {
  AnyEventObject,
  interpret,
  createMachine,
  actions,
  EventObject,
}                         from 'xstate'
import { test }           from 'tstest'
import * as Mailbox       from 'mailbox'
import { createAction }   from 'typesafe-actions'

test('loop machine', async t => {

  const QUERY     = createAction('QUERY',     (id?: number)                 => ({ id }))()
  const RESPONSE  = createAction('RESPONSE',  (id?: number, data?: number)  => id && data ? ({ id, data }) : undefined)()

  const serviceMachine = createMachine({
    id: 'service',
    initial: 'idle',
    states: {
      idle: {
        on: {
          QUERY: 'querying',
        },
      },
      querying: {
        entry: [
          actions.sendParent<{}, ReturnType<typeof QUERY>>(
            (_, e) => RESPONSE(e.payload.id, (e.payload.id ?? 0) * 2),
          ),
        ],
        always: [
          { target: 'idle' },
        ],
      },
    },
  })

  const payloadLoop = (ids: number[] = []) => ({ ids })
  const payloadDone = (datas: ReturnType<typeof RESPONSE>['payload'][] = []) => ({ datas })

  const LOOP = createAction('LOOP', payloadLoop)()
  const NEXT = createAction('NEXT')()
  const DONE = createAction('DONE', payloadDone)()

  type Event = ReturnType<
    | typeof LOOP
    | typeof NEXT
    | typeof DONE
    | typeof RESPONSE
  >

  interface Context {
    ids: number[]
    datas: Exclude<ReturnType<typeof RESPONSE>['payload'], undefined>[]
  }

  const loopMachine = createMachine<Context, Event>({
    id: 'looper',
    context: {
      ids: [],
      datas: [],
    },
    initial: 'idle',
    invoke: {
      id: 'service',
      src: serviceMachine,
    },
    states: {
      idle: {
        on: {
          LOOP: {
            actions: [
              actions.assign({
                datas: _ => [],
                ids: (_, e) => e.payload.ids,
              }),
            ],
            target: 'looping',
          },
        },
      },
      looping: {
        entry: actions.choose<Context, EventObject>([
          {
            cond: ctx => ctx.ids.length > ctx.datas.length,
            actions: [
              actions.send(NEXT()),
            ],
          },
          {
            actions: [
              actions.send(ctx => DONE(ctx.datas)),
            ],
          },
        ]),
        on: {
          NEXT: 'next',
          DONE: 'done',
        },
      },
      next: {
        entry: [
          actions.log(ctx => `next: ${JSON.stringify(ctx.datas)}`),
          actions.send<Context, EventObject>(
            ctx => QUERY(
              ctx.ids.filter(
                id => !ctx.datas
                  .find(data => data.id === id),
              )[0],
            ),
            { to: 'service' },
          ),
        ],
        on: {
          RESPONSE: {
            actions: [
              actions.log((_, e) => `response: ${JSON.stringify(e.payload)}`),
              actions.choose([
                {
                  cond: (_, e) => !!e.payload,
                  actions: [
                    actions.assign<Context, ReturnType<typeof RESPONSE>>({
                      datas: (ctx, e) => [...ctx.datas, e.payload!],
                    }),
                  ],
                },
              ]),
            ],
            target: 'looping',
          },
        },
      },
      done: {
        entry: [
          actions.log(ctx => `done: ${JSON.stringify(ctx.datas)}`),
          actions.sendParent(ctx => DONE(ctx.datas)),
        ],
      },
    },
  })

  const consumerMachine = createMachine({
    id: 'consumer',
    invoke: {
      id: 'looper',
      src: loopMachine,
    },
    on: {
      '*': {
        actions: Mailbox.actions.proxyToChild('consumer')('looper'),
      },
    },
  })

  const consumerEventList: AnyEventObject[] = []
  const interpreter = interpret(consumerMachine)
  interpreter
    .onEvent(e => consumerEventList.push(e))
    .start()

  interpreter.send(LOOP([ 1, 2, 3 ]))
  t.same(consumerEventList, [
    {
      type: 'xstate.init',
    },
    LOOP([ 1, 2, 3 ]),
    DONE([
      RESPONSE(1, 2),
      RESPONSE(2, 4),
      RESPONSE(3, 6),
    ].map(r => r.payload)),
  ], 'should get events')

  interpreter.stop()
})
