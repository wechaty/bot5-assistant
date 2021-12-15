#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/* eslint-disable sort-keys */

import {
  test,
  sinon,
}                   from 'tstest'

import {
  createMachine,
  interpret,
  actions,
  spawn,
}                   from 'xstate'
import { createFixture } from 'wechaty-mocker'

import * as mailbox from './mailbox.js'

test('mailbox actor smoke testing', async t => {
  const MAX_DELAY = 10 * 1000
  const childMachine = createMachine({
    id: 'child',
    initial: 'idle',
    states: {
      idle: {
        entry: [
          actions.log('[child] entry idle state'),
          actions.sendParent(mailbox.events.IDLE()),
        ],
        on: {
          ding: {
            target: 'busy',
            actions: [
              actions.log(_ => '[child] received ding'),
            ],
          },
        },
        exit: [
          actions.log('[child] exit idle state'),
        ],
      },
      busy: {
        entry: [
          actions.log('[child] entry busy state'),
        ],
        after: {
          randomDelay: 'idle',
        },
        exit: [
          actions.log('[child] exit busy state'),
        ],
      },
    },
  }, {
    delays: {
      randomDelay: () => Math.random() * MAX_DELAY,
    },
  })

  const actor = mailbox.wrap(childMachine)

  const interpreter = interpret(actor)
    .onTransition(s => {
      console.info('-------')
      console.info('transition state:', s.value)
      console.info('transition event:', s.event.type, s._event.origin)
      console.info('-------')
    })

  // console.info('mailbox children id list:', [...interpreter.children.keys()])

  interpreter.start()

  interpreter.send('ding')
  interpreter.stop()
})
