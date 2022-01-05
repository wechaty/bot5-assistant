#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
import {
  createInjector,
}                       from 'typed-inject'
import type { Wechaty } from 'wechaty'

import type * as Mailbox from '../mailbox/mod.js'
import * as actors from '../actors/mod.js'

import { InjectionToken } from './tokens.js'

system.inject = [
  InjectionToken.WechatyMailbox,
  InjectionToken.IntentMailbox,
  InjectionToken.FeedbackMailbox,
  InjectionToken.RegisterMailbox,
  InjectionToken.Wechaty,
  InjectionToken.Logger,
] as const

function system (
  wechatyMailbox  : Mailbox.Mailbox,
  intentMailbox   : Mailbox.Mailbox,
  FeedbackMailbox : Mailbox.Mailbox,
  RegisterMailbox : Mailbox.Mailbox,
  wechaty         : Wechaty,
  logger          : Mailbox.MailboxOptions['logger'],
) {
  return {
    mailbox: {
      wechaty: wechatyMailbox,
      intent: intentMailbox,
      feedback: FeedbackMailbox,
      register: RegisterMailbox,
    },
    wechaty,
    logger,
  }
}

interface IocOptions {
  wechaty: Wechaty
  logger: Mailbox.MailboxOptions['logger']
}

const createBot5Injector = (options: IocOptions) => createInjector()
  .provideValue(InjectionToken.Logger,  options.logger)
  .provideValue(InjectionToken.Wechaty, options.wechaty)
  //
  .provideFactory(InjectionToken.WechatyMailbox,  actors.wechaty.mailboxFactory)
  .provideFactory(InjectionToken.IntentMailbox,   actors.intent.mailboxFactory)
  .provideFactory(InjectionToken.FeedbackMailbox, actors.feedback.mailboxFactory)
  .provideFactory(InjectionToken.RegisterMailbox, actors.register.mailboxFactory)

export {
  createBot5Injector,
}
