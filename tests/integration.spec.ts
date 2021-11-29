#!/usr/bin/env -S node --no-warnings --loader ts-node/esm

import {
  test,
}             from 'tstest'

import {
  WechatyBuilder,
}                               from 'wechaty'

import { Bot5Assistant } from '../src/mod.js'

import {
  PuppetMock,
}                 from 'wechaty-puppet-mock'

test.skip('integration testing', async (t) => {
  const Bot5AssistantPlugin = Bot5Assistant({ room: 'fake-id' })

  const bot = WechatyBuilder.build({
    puppet: new PuppetMock(),
  })

  bot.use(Bot5AssistantPlugin)

  t.ok(bot, 'should get a bot')
})
