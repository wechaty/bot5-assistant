#!/usr/bin/env -S node --no-warnings --loader ts-node/esm

import {
  test,
  // sinon,
}             from 'tstest'

import { createFixture } from 'wechaty-mocker'

import {
  getInterpreter,
}                     from './meeting-interpreter.js'
import * as states    from './states.js'
import * as events    from './events.js'

test('Bot5MeetingFsm smoke testing', async t => {
  for await (const fixture of createFixture()) {
    // const sandbox = sinon.createSandbox()
    const interpreter = getInterpreter(fixture.wechaty.wechaty)
    t.ok(interpreter.state.matches(states.idle), 'should be idle')

    t.ok(interpreter.state.can(events.START), 'should can START')

    interpreter.send(events.START)
    t.ok(interpreter.state.matches(states.meeting), 'should be in meeting state')

    t.notOk(interpreter.state.can(events.START), 'should can not START again in meeting')
  }
})
