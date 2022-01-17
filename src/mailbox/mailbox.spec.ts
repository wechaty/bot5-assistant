#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/**
 *   Mailbox - https://github.com/huan/mailbox
 *    author: Huan LI (李卓桓) <zixia@zixia.net>
 *    Dec 2021
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */
/* eslint-disable sort-keys */

import {
  test,
  sinon,
}                   from 'tstest'

import {
  AnyEventObject,
  createMachine,
  actions,
  interpret,
}                   from 'xstate'

import * as Mailbox  from './mod.js'
import * as Baby   from './baby-machine.fixture.js'
import * as DingDong from './ding-dong-machine.fixture.js'

test('Mailbox.from() smoke testing (w/BabyMachine)', async t => {
  const sandbox = sinon.createSandbox({
    useFakeTimers: true,
  })

  const mailbox = Mailbox.from(Baby.machine)
  mailbox.acquire()

  const testMachine = createMachine({
    on: {
      '*': {
        actions: actions.choose([
          {
            cond: (_, __, { _event }) => _event.origin !== String(mailbox.address),
            actions: [
              mailbox.address.send((_, e) => e),
            ],
          },
        ]),
      },
    },
  })

  const eventList: AnyEventObject[] = []
  const interpreter = interpret(testMachine)
  interpreter
    .onEvent(e => eventList.push(e))
    .start()

  const SLEEP_EVENT = Baby.Events.SLEEP(10)
  eventList.length = 0
  interpreter.send(SLEEP_EVENT)
  t.same(
    eventList,
    [
      SLEEP_EVENT,
      // Baby.Events.REST(),
      // Baby.Events.DREAM(),
    ],
    // 'should receive DEAD_LETTER with REST and DREAM event after received the 1st EVENT sleep',
    'should receive the 1st EVENT sleep',
  )

  // // console.info(
  // //   eventList
  // //     .filter(e => e.type === Types.DEAD_LETTER)
  // //     .map(e => (e as any).payload.event)
  // // )
  eventList.length = 0
  await sandbox.clock.tickAsync(9)
  t.same(
    eventList,
    [
      Baby.Events.EAT(),
      Baby.Events.REST(),
      Baby.Events.DREAM(),
      Baby.Events.CRY(),
    ],
    'should receive baby events before wakeup',
  )

  eventList.length = 0
  await sandbox.clock.tickAsync(2)
  t.same(
    eventList,
    [
      Baby.Events.PEE(),
      Baby.Events.PLAY(),
    ],
    'should get one dead letter with PEE&PLAY event after sleep',
  )
  mailbox.dispose()
  sandbox.restore()
})

test('mailbox address interpret smoke testing: 3 parallel EVENTs (w/BabyMachine)', async t => {
  const sandbox = sinon.createSandbox({
    useFakeTimers: true,
  })

  const mailbox = Mailbox.from(Baby.machine)
  mailbox.acquire()

  const testMachine = createMachine({
    on: {
      '*': {
        actions: actions.choose([
          {
            cond: (_, __, { _event }) => _event.origin !== String(mailbox.address),
            actions: [
              mailbox.address.send((_, e) => e),
            ],
          },
        ]),
      },
    },
  })

  const eventList: AnyEventObject[] = []
  const interpreter = interpret(testMachine)
  interpreter
    .onEvent(e => eventList.push(e))
    .start()

  eventList.length = 0
  interpreter.send(Baby.Events.SLEEP(10))
  t.same(
    eventList,
    [
      Baby.Events.SLEEP(10),
    ],
    'should received SLEEP event',
  )

  eventList.length = 0
  interpreter.send(Baby.Events.SLEEP(20))
  t.same(eventList, [Baby.Events.SLEEP(20)], 'should received SLEEP event')

  /**
   * Finish 1st (will right enter the 2nd)
   */
  eventList.length = 0
  await sandbox.clock.tickAsync(10)
  t.same(
    eventList,
    [
      Baby.Events.EAT(),
      Baby.Events.REST(),
      Baby.Events.DREAM(),
      Baby.Events.CRY(),
    ],
    'should before enter 2nd SLEEP after 10 ms',
  )
  // console.info('#### queue:', snapshot.context.queue)

  /**
   * Finish 2nd
   */
  eventList.length = 0
  await sandbox.clock.tickAsync(20)
  t.same(
    eventList,
    [
      Baby.Events.PEE(),
      Baby.Events.PLAY(),
      Baby.Events.EAT(),
      Baby.Events.REST(),
      Baby.Events.DREAM(),
      Baby.Events.CRY(),
    ],
    'should before enter 3rd SLEEP after another 20 ms',
  )

  /**
   * Finish 3rd
   */
  eventList.length = 0
  await sandbox.clock.tickAsync(30)
  t.same(eventList, [
    Baby.Events.PEE(),
    Baby.Events.PLAY(),
  ], 'should enter wakeup state')

  mailbox.dispose()
  sandbox.restore()
})

test('mailbox address interpret smoke testing: 3 EVENTs with respond (w/BabyMachine)', async t => {
  const sandbox = sinon.createSandbox({
    useFakeTimers: true,
  })

  const mailbox = Mailbox.from(Baby.machine)
  mailbox.acquire()

  const testMachine = createMachine({
    on: {
      '*': {
        actions: actions.choose([
          {
            cond: (_, __, { _event }) => _event.origin !== String(mailbox.address),
            actions: [
              mailbox.address.send((_, e) => e),
            ],
          },
        ]),
      },
    },
  })

  const eventList: AnyEventObject[] = []
  const interpreter = interpret(testMachine)
  interpreter
    .onEvent(e => eventList.push(e))
    .start()

  Array.from({ length: 3 }).forEach(_ => {
    // console.info('EVENT: sleep sending...')
    interpreter.send(Baby.Events.SLEEP(10))
    // console.info('EVENT: sleep sending... done')
  })

  eventList.length = 0
  await sandbox.clock.tickAsync(10)
  t.same(
    eventList
      .map(e => e.type)
      .filter(t => Object.values<string>(Baby.Types).includes(t)),
    [
      Baby.Types.EAT,
      Baby.Types.REST,
      Baby.Types.DREAM,
      Baby.Types.CRY,
    ],
    'should enter next SLEEP(DREAM) after 1st 10 ms',
  )

  eventList.length = 0
  await sandbox.clock.tickAsync(10)
  t.same(
    eventList
      .map(e => e.type)
      .filter(t => Object.values<string>(Baby.Types).includes(t)),
    [
      Baby.Types.PEE,
      Baby.Types.PLAY,
      Baby.Types.EAT,
      Baby.Types.REST,
      Baby.Types.DREAM,
      Baby.Types.CRY,
    ],
    'should enter next SLEEP(DREAM) after 2nd 10 ms',
  )

  eventList.length = 0
  await sandbox.clock.tickAsync(10)
  t.same(
    eventList
      .map(e => e.type)
      .filter(t => Object.values<string>(Baby.Types).includes(t)),
    [
      Baby.Types.PEE,
      Baby.Types.PLAY,
      Baby.Types.EAT,
      Baby.Types.REST,
      Baby.Types.DREAM,
      Baby.Types.CRY,
    ],
    'should receive event child.events.PLAY after 3rd 10 ms',
  )

  mailbox.dispose()
  sandbox.restore()
})

test('Mailbox Address smoke testing (w/DingDongMachine)', async t => {
  const sandbox = sinon.createSandbox({
    useFakeTimers: true,
  })
  const spy = sandbox.spy()

  const dingDong = Mailbox.from(DingDong.machine)

  const ADDRESS = String(dingDong.address)

  const testMachine = createMachine({
    on: {
      TEST: {
        actions: actions.send(DingDong.Events.DING(0), { to: ADDRESS }),
      },
      [DingDong.Types.DONG]: {
        actions: spy,
      },
    },
  })

  const interpreter = interpret(testMachine)
  dingDong.acquire()
  interpreter.start()

  interpreter.send('TEST')
  await sandbox.clock.runAllAsync()
  t.ok(spy.calledOnce, 'should be called once')

  interpreter.stop()
  dingDong.dispose()

  sandbox.restore()
})

test('Mailbox debug properties smoke testing (w/DingDongMachine)', async t => {
  const mailbox = Mailbox.from(DingDong.machine) as Mailbox.MailboxImpl
  t.ok(mailbox.debug.machine, 'should has machine')
  t.same(mailbox.debug.target.machine, DingDong.machine, 'should has target machine')

  t.notOk(mailbox.debug.interpreter, 'should has no interpreter initialized before acquire()')
  t.notOk(mailbox.debug.target.interpreter, 'should has no target interpreter initialized before acquire()')

  mailbox.acquire()

  t.ok(mailbox.debug.interpreter, 'should has interpreter after acquire()')
  t.ok(mailbox.debug.target.interpreter, 'should has target interpreter after acquire()')

  mailbox.dispose()
  t.notOk(mailbox.debug.interpreter, 'should has no interpreter initialized after dispose()')
  t.notOk(mailbox.debug.target.interpreter, 'should has no target interpreter initialized after dispose()')
})
