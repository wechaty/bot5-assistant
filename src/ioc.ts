#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
import { createInjector } from 'typed-inject'
import type {
  StateMachine,
}                 from 'xstate'
import type { Wechaty } from 'wechaty'

import {
  Mailbox,
  type Address,
}                     from './mailbox/mod.js'
import * as actors from './actors/mod.js'
import { Events } from './schemas/mod.js'

enum InjectorToken {
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

function wechatyActorAddress (wechaty: Wechaty) {
  const mailbox = Mailbox.from(actors.wechatyMachine)
  mailbox.start()
  mailbox.send(Events.WECHATY(wechaty))
  return mailbox.address
}
wechatyActorAddress.inject = [InjectorToken.Wechaty] as const

const actorAddress = (machine: StateMachine<any, any, any>) => () => {
  const mailbox = Mailbox.from(machine)
  mailbox.start()
  return mailbox.address
}

function assistantActor (
  wechatyAddress: Address,
  intentAddress: Address,
) {
  console.info('wechaty', '' + wechatyAddress)
  console.info('intent', '' + intentAddress)
}
assistantActor.inject = [
  InjectorToken.WechatyActorAddress,
  InjectorToken.IntentActorAddress,
] as const

function bootstrap (wechaty: Wechaty) {

  const assistantInjector = createInjector()
    .provideValue(InjectorToken.Wechaty, wechaty)
    .provideFactory(InjectorToken.WechatyActorAddress, wechatyActorAddress)
    //
    .provideFactory(InjectorToken.IntentActorAddress,   actorAddress(actors.intentMachine))
    .provideFactory(InjectorToken.FeedbackActorAddress, actorAddress(actors.feedbackMachine))
    .provideFactory(InjectorToken.RegisterActorAddress, actorAddress(actors.registerMachine))

  assistantInjector.injectFunction(assistantActor)
}

bootstrap({} as any)
