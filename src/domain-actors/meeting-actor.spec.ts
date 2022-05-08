#!/usr/bin/env -S node --no-warnings --loader ts-node/esm

import { test }       from 'tstest'
import { interpret }  from 'xstate'

import * as duck    from '../duck/mod.js'

import { bot5Fixtures }   from '../fixtures/bot5-fixture.js'
import * as MeetingActor  from './meeting/machine.js'

test('MeetingActor smoke testing', async t => {
  for await (const {
    mocker: mockerFixtures,
    wechaty: wechatyFixtures,
  } of bot5Fixtures()) {
    void mockerFixtures
    void wechatyFixtures
    // const sandbox = sinon.createSandbox()
    const interpreter = interpret(MeetingActor.machineFactory())
    interpreter.start()

    t.ok(interpreter.state.matches(duck.State.Idle), 'should be idle')

    // Huan(202201): remove any
    t.ok(interpreter.state.can(duck.Type.START as any), 'should can START')

    interpreter.send(MeetingActor.Events.START())
    t.ok(interpreter.state.matches(duck.State.meeting), 'should be in meeting state')

    t.notOk(interpreter.state.can(duck.Type.START as any), 'should can not START again in meeting')
  }
})
