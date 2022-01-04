#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
import { createInjector } from 'typed-inject'
import type {
  StateMachine,
}                 from 'xstate'
import type { Wechaty } from 'wechaty'

import * as Mailbox from './mailbox/mod.js'
import * as actors from './actors/mod.js'
import { Events } from './schemas/mod.js'

enum InjectionToken {
  Wechaty = 'wechaty',
  WechatyActorAddress = 'wechaty-actor-address',
  IntentActorAddress = 'intent-actor-address',
  FeedbackActorAddress = 'feedback-actor-address',
  RegisterActorAddress = 'register-actor-address',

  WechatyId = 'wechaty-id',
  IntentId = 'intent-id',

  WechatyInterpreter = 'wechaty-interpreter',
  IntentInterpreter = 'intent-interpreter',

  WechatyActor = 'wechaty-actor',
  IntentActor = 'intent-actor',

  WechatyMachine = 'wechaty-machine',
  IntentMachine = 'intent-machine',
}

wechatyActorAddress.inject = [InjectionToken.Wechaty] as const
function wechatyActorAddress (wechaty: Wechaty) {
  const mailbox = Mailbox.from(actors.wechatyMachine)
  mailbox.start()
  mailbox.address.send(Events.WECHATY(wechaty))
  return mailbox.address
}

const actorAddress = (machine: StateMachine<any, any, any>) => () => {
  const mailbox = Mailbox.from(machine)
  mailbox.start()
  return mailbox.address
}

assistantActor.inject = [
  InjectionToken.WechatyActorAddress,
  InjectionToken.IntentActorAddress,
] as const
function assistantActor (
  wechatyAddress: Mailbox.Address,
  intentAddress: Mailbox.Address,
) {
  console.info('wechaty', '' + wechatyAddress)
  console.info('intent', '' + intentAddress)
}

function bootstrap (wechaty: Wechaty) {

  const assistantInjector = createInjector()
    .provideValue(InjectionToken.Wechaty, wechaty)
    .provideFactory(InjectionToken.WechatyActorAddress, wechatyActorAddress)
    //
    .provideFactory(InjectionToken.IntentActorAddress,   actorAddress(actors.intentMachine))
    .provideFactory(InjectionToken.FeedbackActorAddress, actorAddress(actors.feedbackMachine))
    .provideFactory(InjectionToken.RegisterActorAddress, actorAddress(actors.registerMachine))

  assistantInjector.injectFunction(assistantActor)
}

bootstrap({} as any)
