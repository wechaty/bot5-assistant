#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
import { createInjector }   from 'typed-inject'
import type { Wechaty }     from 'wechaty'
import type * as Mailbox    from 'mailbox'
import type { Observable }  from 'rxjs'

// import type {
//   // Ducks,
//   Bundle,
// }                         from 'ducks'
// import type {
//   Duck as WechatyDuck,
// }                         from 'wechaty-redux'

import * as actors from '../actors/mod.js'

import { InjectionToken } from './tokens.js'

resolveAll.inject = [
  InjectionToken.WechatyMailbox,
  InjectionToken.IntentMailbox,
  InjectionToken.FeedbackMailbox,
  InjectionToken.RegisterMailbox,
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
    logger,
    mailbox: {
      feedback: feedbackMailbox,
      intent:   intentMailbox,
      register: registerMailbox,
      wechaty:  wechatyMailbox,
    },
    wechaty,
  }
}

interface IocOptions {
  bus$      : Observable<any>,
  devTools? : Mailbox.Options['devTools']
  logger?   : Mailbox.Options['logger']
}

const createBot5Injector = (options: IocOptions) => createInjector()
  .provideValue(InjectionToken.Bus$,      options.bus$)
  .provideValue(InjectionToken.DevTools,  options.devTools)
  .provideValue(InjectionToken.Logger,    options.logger)
  // .provideValue(InjectionToken.WechatyDuck, options.wechatyDuck)
  //
  .provideFactory(InjectionToken.WechatyMailbox,  actors.wechaty.mailboxFactory)
  .provideFactory(InjectionToken.IntentMailbox,   actors.intent.mailboxFactory)
  .provideFactory(InjectionToken.RegisterMailbox, actors.register.mailboxFactory)
  .provideFactory(InjectionToken.FeedbackMailbox, actors.feedback.mailboxFactory)

export {
  createBot5Injector,
}
