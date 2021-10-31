#!/usr/bin/env -S node --no-warnings --loader ts-node/esm

import {
  test,
  // sinon,
}             from 'tstest'

import { createFixture } from 'wechaty-mocker'

import {
  getInterpreter,
}                     from './meeting-interpreter.js'

test('Bot5MeetingFsm smoke testing', async t => {
  for await (const fixture of createFixture()) {
    // const sandbox = sinon.createSandbox()
    const interpreter = getInterpreter(fixture.wechaty.wechaty)
    t.ok(interpreter.state.matches('idle'), 'should be idle')

    t.ok(interpreter.state.can('START'), 'should can START')

    interpreter.send('START')
    t.ok(interpreter.state.matches('meeting'), 'should be in meeting state')

    t.notOk(interpreter.state.can('START'), 'should can not START again in meeting')
  }
})
