#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/* eslint-disable sort-keys */

import {
  test,
  sinon,
}                   from 'tstest'
import {
  actions,
  ActorRef,
  AnyEventObject,
  createMachine,
  GuardMeta,
  interpret,
  SCXML,
}                 from 'xstate'

import { Actions as MailboxActions } from './actions.js'
import { Events as MailboxEvents } from './events.js'

/**
 * Issue #11 - Race condition: Mailbox think the target machine is busy when it's not
 *  @link https://github.com/wechaty/bot5-assistant/issues/11
 */
test('reply()', async t => {
  const targetMachine = createMachine({
    id: 'target-machine-id',
    initial: 'idle',
    states: {
      idle: {
        entry: [
          MailboxActions.reply('FIRST_LINE'),
          actions.sendParent('SECOND_LINE'),
        ],
      },
    },
  })

  const testMachine = createMachine({
    invoke: {
      src: targetMachine,
    },
  })

  const interpreter = interpret(testMachine)
  const eventList: AnyEventObject[] = []
  interpreter
    .onEvent(e => eventList.push(e))
    .start()

  await new Promise(r => setTimeout(r, 0))
  t.same(
    eventList,
    [
      { type: 'xstate.init' },
      { type: 'SECOND_LINE' },
      MailboxEvents.CHILD_REPLY({ type: 'FIRST_LINE' }),
    ],
    'should send reply event to parent in the next event loop',
  )
})
