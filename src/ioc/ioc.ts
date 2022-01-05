#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
import {
  createInjector,
  Disposable,
}                       from 'typed-inject'
import type { Wechaty } from 'wechaty'
import {
  log,
  Logger,
  getLogger,
}               from 'brolog'

import type * as Mailbox from '../mailbox/mod.js'
import * as actors from '../actors/mod.js'

import { InjectionToken } from './tokens.js'

assistantActor.inject = [
  InjectionToken.WechatyMailbox,
  InjectionToken.IntentMailbox,
] as const
function assistantActor (
  wechatyMailbox: Mailbox.Mailbox,
  intentMailbox: Mailbox.Mailbox,
) {
  console.info('wechaty', '' + wechatyMailbox.address)
  console.info('intent', '' + intentMailbox.address)
}

async function bootstrap (wechaty: Wechaty, logger: Logger) {

  const assistantInjector = createInjector()
    .provideFactory(InjectionToken.Logger, () => getLogger(logger))
    .provideValue(InjectionToken.Wechaty, wechaty)
    .provideFactory(InjectionToken.WechatyMailbox, actors.wechaty.mailboxFactory)
    //
    .provideFactory(InjectionToken.IntentMailbox,   actors.intent.mailboxFactory)
    .provideFactory(InjectionToken.FeedbackMailbox, actors.feedback.mailboxFactory)
    .provideFactory(InjectionToken.RegisterMailbox, actors.register.mailboxFactory)

  assistantInjector.injectFunction(assistantActor)

  await assistantInjector.dispose()
}

await bootstrap({} as any, log)
