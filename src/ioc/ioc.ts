#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
import {
  createInjector,
}                       from 'typed-inject'
import type { Wechaty } from 'wechaty'

import type * as Mailbox from '../mailbox/mod.js'
import * as actors from '../actors/mod.js'

import { InjectionToken } from './tokens.js'

resolveAll.inject = [
  InjectionToken.WechatyMailbox,
  InjectionToken.IntentMailbox,
  InjectionToken.FeedbackMailbox,
  InjectionToken.RegisterMailbox,
  InjectionToken.Wechaty,
  InjectionToken.Logger,
] as const

function resolveAll (
  wechatyMailbox  : Mailbox.Interface,
  intentMailbox   : Mailbox.Interface,
  feedbackMailbox : Mailbox.Interface,
  registerMailbox : Mailbox.Interface,
  wechaty         : Wechaty,
  logger          : Mailbox.Options['logger'],
) {
  return {
    mailbox: {
      wechaty:  wechatyMailbox,
      intent:   intentMailbox,
      feedback: feedbackMailbox,
      register: registerMailbox,
    },
    wechaty,
    logger,
  }
}

interface IocOptions {
  wechaty: Wechaty
  //
  logger?:    Mailbox.Options['logger']
  devTools?:  Mailbox.Options['devTools']
}

const createBot5Injector = (options: IocOptions) => createInjector()
  .provideValue(InjectionToken.DevTools,  options.devTools)
  .provideValue(InjectionToken.Logger,    options.logger)
  .provideValue(InjectionToken.Wechaty,   options.wechaty)
  //
  .provideFactory(InjectionToken.WechatyMailbox,  actors.wechaty.mailboxFactory)
  .provideFactory(InjectionToken.IntentMailbox,   actors.intent.mailboxFactory)
  .provideFactory(InjectionToken.RegisterMailbox, actors.register.mailboxFactory)
  .provideFactory(InjectionToken.FeedbackMailbox, actors.feedback.mailboxFactory)

export {
  createBot5Injector,
}
