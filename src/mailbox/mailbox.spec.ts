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

test('Mailbox.from() smoke testing', async t => {
  const sandbox = sinon.createSandbox({
    useFakeTimers: true,
  })

  const mailbox = Mailbox.from(Baby.machine)

  const eventList: AnyEventObject[] = []

  mailbox.on('event', e => eventList.push(e))
  mailbox.start()

  t.same(eventList, [
    Mailbox.Events.DEAD_LETTER(Baby.Events.PLAY(), 'message baby/PLAY@x:1 dropped'),
  ], 'should received DEAD_LETTER with PLAY event')

  eventList.length = 0
  mailbox.address.send(Baby.Events.SLEEP(10))
  t.same(eventList, [
    Baby.Events.SLEEP(10),
    Mailbox.Events.DEAD_LETTER(Baby.Events.REST(), 'message baby/REST@x:1 dropped'),
    Mailbox.Events.DEAD_LETTER(Baby.Events.DREAM(), 'message baby/DREAM@x:1 dropped'),
  ], 'should receive DEAD_LETTER with REST and DREAM event after received the 1st EVENT sleep')

  // // console.info(
  // //   eventList
  // //     .filter(e => e.type === Types.DEAD_LETTER)
  // //     .map(e => (e as any).payload.event)
  // // )
  eventList.length = 0
  await sandbox.clock.tickAsync(9)
  t.same(eventList, [
    Mailbox.Events.DEAD_LETTER(
      Baby.Events.CRY(),
      'message baby/CRY@x:1 dropped',
    ),
  ], 'should receive event child.Types.CRY after before wakeup')

  eventList.length = 0
  await sandbox.clock.tickAsync(1)
  t.same(eventList, [
    Mailbox.Events.DEAD_LETTER(
      Baby.Events.PEE(),
      'message baby/PEE@x:1 dropped',
    ),
    Mailbox.Events.DEAD_LETTER(
      Baby.Events.PLAY(),
      'message baby/PLAY@x:1 dropped',
    ),
  ], 'should get one dead letter with PEE&PLAY event after sleep')
  mailbox.stop()
  sandbox.restore()
})

test('mailbox address interpret smoke testing: 3 parallel EVENTs', async t => {
  const sandbox = sinon.createSandbox({
    useFakeTimers: true,
  })

  const mailbox = Mailbox.from(Baby.machine)

  const eventList: AnyEventObject[] = []

  mailbox.on('event', e => eventList.push(e))
  mailbox.start()

  eventList.length = 0
  mailbox.address.send(Baby.Events.SLEEP(10))

  t.same(eventList, [
    Baby.Events.SLEEP(10),
    Mailbox.Events.DEAD_LETTER(
      Baby.Events.REST(),
      'message baby/REST@x:3 dropped'
    ),
    Mailbox.Events.DEAD_LETTER(
      Baby.Events.DREAM(),
      'message baby/DREAM@x:3 dropped',
    ),
  ], 'should received DEAD_LETTER with REST and DREAM event')

  mailbox.address.send(Baby.Events.SLEEP(20))

  /**
   * Finish 1st (will right enter the 2nd)
   */
  eventList.length = 0
  await sandbox.clock.tickAsync(10)
  t.same(eventList, [
    Mailbox.Events.DEAD_LETTER(
      Baby.Events.CRY(),
      'message baby/CRY@x:3 dropped',
    ),
    Mailbox.Events.DEAD_LETTER(
      Baby.Events.PEE(),
      'message baby/PEE@x:3 dropped',
    ),
    Mailbox.Events.DEAD_LETTER(
      Baby.Events.PLAY(),
      'message baby/PLAY@x:3 dropped',
    ),
    Mailbox.Events.DEAD_LETTER(
      Baby.Events.REST(),
      'message baby/REST@x:3 dropped',
    ),
    Mailbox.Events.DEAD_LETTER(
      Baby.Events.DREAM(),
      'message baby/DREAM@x:3 dropped',
    ),
  ], 'should right enter 2nd SLEEP after 10 ms')
  // console.info('#### queue:', snapshot.context.queue)

  /**
   * Finish 2nd
   */
  eventList.length = 0
  await sandbox.clock.tickAsync(20)

  t.same(eventList, [
    Mailbox.Events.DEAD_LETTER(
      Baby.Events.CRY(),
      'message baby/CRY@x:3 dropped',
    ),
    Mailbox.Events.DEAD_LETTER(
      Baby.Events.PEE(),
      'message baby/PEE@x:3 dropped',
    ),
    Mailbox.Events.DEAD_LETTER(
      Baby.Events.PLAY(),
      'message baby/PLAY@x:3 dropped',
    ),
  ], 'should right enter 3rd SLEEP after another 20 ms')

  /**
   * Finish 3rd
   */
  eventList.length = 0
  await sandbox.clock.tickAsync(30)
  t.same(eventList, [], 'should be empty')

  mailbox.stop()
  sandbox.restore()
})

test('mailbox address interpret smoke testing: 3 EVENTs with respond', async t => {
  const sandbox = sinon.createSandbox({
    useFakeTimers: true,
  })

  const mailbox = Mailbox.from(Baby.machine)

  const eventList: AnyEventObject[] = []
  mailbox.on('event', (e => eventList.push(e)))
  // console.info('initialState:', actor.initialState)
  mailbox.start()

  Array.from({ length: 3 }).forEach(_ => {
    // console.info('EVENT: sleep sending...')
    mailbox.address.send(Baby.Events.SLEEP(10))
    // console.info('EVENT: sleep sending... done')
  })

  eventList.length = 0
  await sandbox.clock.tickAsync(10)
  t.same(
    eventList
      .filter(e => e.type === Mailbox.Types.DEAD_LETTER)
      .map(e => (e as ReturnType<typeof Mailbox.Events.DEAD_LETTER>).payload.message.type)
      .filter(t => Object.values<string>(Baby.Types).includes(t)),
    [
      Baby.Types.CRY,
      Baby.Types.PEE,
      Baby.Types.PLAY,
      Baby.Types.REST,
      Baby.Types.DREAM,
    ],
    'should enter next SLEEP(DREAM) after 1st 10 ms',
  )

  eventList.length = 0
  await sandbox.clock.tickAsync(10)
  t.same(
    eventList
    .filter(e => e.type === Mailbox.Types.DEAD_LETTER)
    .map(e => (e as ReturnType<typeof Mailbox.Events.DEAD_LETTER>).payload.message.type)
    .filter(t => Object.values<string>(Baby.Types).includes(t)),
    [
      Baby.Types.CRY,
      Baby.Types.PEE,
      Baby.Types.PLAY,
      Baby.Types.REST,
      Baby.Types.DREAM,
    ],
    'should enter next SLEEP(DREAM) after 2nd 10 ms',
  )

  eventList.length = 0
  await sandbox.clock.tickAsync(10)
  t.same(
    eventList
    .filter(e => e.type === Mailbox.Types.DEAD_LETTER)
    .map(e => (e as ReturnType<typeof Mailbox.Events.DEAD_LETTER>).payload.message.type)
    .filter(t => Object.values<string>(Baby.Types).includes(t)),
    [
      Baby.Types.CRY,
      Baby.Types.PEE,
      Baby.Types.PLAY,
    ],
    'should receive event child.events.PLAY after 3rd 10 ms',
  )

  mailbox.stop()
  sandbox.restore()
})

test('Mailbox Address smoke testing', async t => {
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
  dingDong.start()
  interpreter.start()

  interpreter.send('TEST')
  await sandbox.clock.runAllAsync()
  t.ok(spy.calledOnce, 'should be called once')

  interpreter.stop()
  dingDong.stop()

  sandbox.restore()
})
