#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
import { createInjector } from 'typed-inject'
import type { Wechaty } from 'wechaty'

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

function bootstrap (wechaty: Wechaty) {

  const assistantInjector = createInjector()
    .provideValue(InjectionToken.Wechaty, wechaty)
    .provideFactory(InjectionToken.WechatyMailbox, actors.wechaty.mailboxFactory)
    //
    .provideFactory(InjectionToken.IntentMailbox,   actors.intent.mailboxFactory)
    .provideFactory(InjectionToken.FeedbackMailbox, actors.feedback.mailboxFactory)
    .provideFactory(InjectionToken.RegisterMailbox, actors.register.mailboxFactory)

  assistantInjector.injectFunction(assistantActor)
}

bootstrap({} as any)
