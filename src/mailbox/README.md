## Mailbox (Actor/XState)

A XState wrapper to implement Mailbox of Actor Model.

![Actor Model: Mailbox](mailbox.png)

> Mailboxes are one of the fundamental parts of the actor model. Through the mailbox mechanism, actors can decouple the reception of a message from its elaboration.
> 
> 1. An actor is an object that carries out its actions in response to communications it receives.
> 1. A mailbox is nothing more than the data structure that holds messages.
> 
> &mdash; <https://www.baeldung.com/scala/typed-mailboxes>

> if you send 3 messages to the same actor, it will just execute one at a time.  
> &mdash; [The actor model in 10 minutes - Actors have mailboxes](https://www.brianstorti.com/the-actor-model/)

## Motivation

I'm building assistant chatbot for Wechaty community, and I want to use actor model based on XState to implement it.

My actor will receive message from Wechaty, and send message to Wechaty.

However, ... (describe the async & multi-user scanerio for the conversation turns)

It turns out ... (describe that we need to make sure the incoming messages are queued when we not finished processing the last one)

> Thread-safe code only manipulates shared data structures in a manner that ensures that all threads behave properly and fulfill their design specifications without unintended interaction.

- [Wikipedia: Thread Safety](https://en.wikipedia.org/wiki/Thread_safety)

## The Problem

A naive state machine is a mailbox actor with `capacity=0`, which means it will face the `Dead Letter` problem when new messages come but it has not finished processing the last one.

Assume we are a coffee maker, and we need 4 three steps to make a coffee:

1. received a `MAKE_ME_COFFEE` event from a customer (sync)
1. get a cup (async: cost some time)
1. fill coffee into the cup (async: cost some time)
1. send a `COFFEE` event to the customer (sync)

The coffee maker can only make one cup of coffee at a time, which means that we can not process the `MAKE_ME_COFFEE` event until we have finished the last one.

The state machine of the coffee maker is:

[![coffee maker machine](https://stately.ai/registry/machines/5bd10d92-3d39-49b5-ad0d-13a8a0a43891.png)](https://stately.ai/viz/5bd10d92-3d39-49b5-ad0d-13a8a0a43891)

Here's the source code of coffee maker:

```ts
const machine = createMachine<Context, Event>({
  context: {
    customer: null,
  },
  initial: States.idle,
  states: {
    [States.idle]: {
      entry: Mailbox.Actions.receive('coffee-maker'),
      on: {
        [Types.MAKE_ME_COFFEE]: {
          target: States.gettingCup,
          actions: actions.assign((_, e) => ({ customer: e.customer })),
        },
        '*': States.idle,
      },
    },
    [States.gettingCup]: {
      after: {
        10: States.fillingCoffee,
      },
    },
    [States.fillingCoffee]: {
      after: {
        10: States.delivering,
      },
    },
    [States.delivering]: {
      entry: actions.sendParent(ctx => Events.COFFEE(ctx.customer || 'NO CUSTOMER')),
      after: {
        10: States.idle,
      },
      exit: actions.assign({ customer: _ => null }),
    },
  },
})
```

If there's a new customer come in, and he/she want coffee, we can get a cup then fill coffee to the cup then delive a cup of coffee to our customer. Everything is fine as far as we know.

However, two customer come in, and they talk to us at the same time and each customer want a cup of coffee. After we received the first request(event/message), we are starting to get cup and can not listen to another request anymore, which will result an event (the second one) lost (a Dead Letter).

## The Solution

An actor should read the messages to process from its mailbox. A mailbox is an event proxy that holds messages and deals with the backpressure. When the actor can continue processing the next event, it receives the next event from the mailbox.

[Mailbox](https://www.npmjs.com/package/mailbox) for rescue.

Mailbox is a NPM module written in TypeScript based on the XState finite state machine to strict follow the actor model's principle:

```ts
const mailboxAddress = Mailboxe.address(machine)
```

Then use `mailboxAddress` instead.

## Actor Mailbox Concept

Actors have mailboxes.

> In the actor model, we must follow that: "if you send 3 messages to the same actor, it will just execute one at a time."
>
> It’s important to understand that, although multiple actors can run at the same time, an actor will process a given message sequentially. This means that if you send 3 messages to the same actor, it will just execute one at a time. To have these 3 messages being executed concurrently, you need to create 3 actors and send one message each.
>
> Messages are sent asynchronously to an actor, that needs to store them somewhere while it’s processing another message. The mailbox is the place where these messages are stored.
>
> &mdash; [The actor model in 10 minutes](https://www.brianstorti.com/the-actor-model/)

> an actor is started it will keep running, processing messages from its inbox and won’t stop unless you stop it. It will maintain its state throughout and only the actor has access to this state. This is unlike your traditional asynchronous programming, such as using Future in Scala or promises in javascript where once the call has finished its state between calls is not maintained and the call has finished.
>
> Once an actor receives a message, it adds the message to its mailbox. You can think of the mailbox as queue where the actor picks up the next message it needs to process. Actors process one message at a time. The actor patterns specification does say that the order of messages received is not guaranteed, but different implementations of the actor pattern do offer choices on mailbox type which do offer options on how messages received are prioritized for processing.
>
> &mdash; [Introduction to the Actor Model](https://www.softinio.com/post/introduction-to-the-actor-model/)

## Usage

### XState Machine

1. Must `sendParent(Mailbox.Actions.sendParentIdle('machine-name'))` when it's ready to receive message (in `states.idle` for example)
1. All events that received in `states.idle` must make a `external` trancition by adding a `target` entry, so that the `staes.idle` state will be entered again, which will emit the `sendParent(Mailbox.Actions.sendParentIdle('machine-name'))` to let the Mailbox.address know it's ready to receive message.

Learn more from [validate.ts source code](validate.ts)

### Dead Letter

Whenever a message fails to be written into an actor mailbox, the actor system redirects it to a synthetic actor called /deadLetters. The delivery guarantees of dead letter messages are the same as any other message in the system. So, it’s better not to trust so much in such messages. The main purpose of dead letters is debugging.

```ts
mailboxAddress.onEvent(event => {
  if (event.type === Mailbox.Types.DeadLetter) {
    console.error('DeadLetter:', event.payload)
  }
})  
```

Related reading:

- [Proto.Actor - Dead Letters](https://proto.actor/docs/deadletter/)

### Bounded vs. Unbounded

The mailbox is unbounded by default, which means it doesn’t reject any delivered message. Besides, there’s no back pressure mechanism implemented in the actor system. Hence, if the number of incoming messages is far bigger than the actor’s execution pace, the system will quickly run out of memory.

As we said, unbounded mailboxes grow indefinitely, consuming all the available memory if the messages’ producers are far quicker than the consumers. Hence, we use this kind of mailbox only for trivial use cases.

On the other side, bounded mailboxes retain only a fixed number of messages. The actor system will discard all of the messages arriving at the actor when the mailbox is full. This way, we can avoid running out of memory.

As we did a moment ago, we can configure the mailbox’s size directly using the Mailbox.bounded factory method. Or, better, we can specify it through the configuration properties file:

```ts
const mailboxAddress = Mailboxe.address(machine, { 
  capacity: 100,
})
```

The example above is a clear example where bounded mailboxes shine. We are not afraid of losing some messages if the counterpart maintains the system up and running.

A new question should arise: Where do the discarded messages go? Are they just thrown away? Fortunately, the actor system lets us retrieve information about discarded messages through the mechanism of dead letters — we’ll soon learn more about how this works.

> Credit: <https://www.baeldung.com/scala/typed-mailboxes#1-bounded-vs-unbounded>

## Actor Patterns

### The Tell Pattern

> Tell, Don’t Ask!

It’s often said that we must “tell an actor and not ask something“. The reason for this is that the tell pattern represents the fully asynchronous way for two actors to communicate.

The tell pattern is entirely asynchronous. After the message is sent, it’s impossible to know if the message was received or if the process succeeded or failed.

To use the Tell Pattern, an actor must retrieve an actor reference to the actor it wants to send the message to.

> See also: [Akka Interaction Patterns: The Tell Pattern](https://www.baeldung.com/scala/akka-tell-pattern)

### The Ask Pattern

> Request-Response

The Ask Pattern allows us to implement the interactions that need to associate a request to precisely one response. So, it’s different from the more straightforward adapted response pattern because we can now associate a response with its request.

The Mailbox implementes the Ask Pattern by default. It will response to the original actor sender when there's any response events from the child actor.

## History

### main

WIP...

### v0.1 (Dec 24, 2021)

Improving the Actor Mailbox model.

Related links:

- [XState Actors](https://xstate.js.org/docs/guides/actors.html#actor-api)
- [Typed Mailboxes in Scala, @Riccardo Cardin, Feb 23, 2021](https://www.baeldung.com/scala/typed-mailboxes)
- [Proto.Actor - Mailboxes](https://proto.actor/docs/mailboxes/)

### v0.0.1 (Dec 18, 2021)

Initial version.

Related issue discussions:

- [Track the Modeling Events of XState wechaty/bot5-assistant#2](https://github.com/wechaty/bot5-assistant/issues/2)
- [Actor model needs a Mailbox wrapper/concurrency-manager wechaty/bot5-assistant#4](https://github.com/wechaty/bot5-assistant/issues/4)
- [Discord Actor Model discussion](https://discord.com/channels/795785288994652170/800812250306183178/917329930294009877)
- [Kotlin Concurrency with Actors, Jag Saund, Jun 14, 2018](https://medium.com/@jagsaund/kotlin-concurrency-with-actors-34bd12531182)
- [xstate-onentry-timing-bug.js](https://github.com/statelyai/xstate/issues/370#issuecomment-465954271)
- [[v5] Optimize mailbox statelyai/xstate#2870](https://github.com/statelyai/xstate/issues/2870)
- [Automating Spaceships with XState, @stafford Williams, Mar 22, 2021](https://staffordwilliams.com/blog/2021/03/22/automating-spaceships-with-xstate/), 

## Special Thanks

Great thanks to [@alxhotel](https://github.com/alxhotel) who owned the great NPM module name [mailbox](https://www.npmjs.com/package/mailbox) and kindly transfered it to me for this new project, thank you very much [Alex](https://twitter.com/alxhotel)!

> Hi Huan, nice to meet you :) Glad to see a serial entrepreneur contributing to OSS Red heart I've added you as a maintainer! Feel free to remove me once you make sure you have control of the package. Looking forward to see what you are building :)
>
> Cheers,  
> Alex (Dec 20 Mon 11:47 PM)

## Author

[Huan LI](https://github.com/huan) ([李卓桓](http://linkedin.com/in/zixia)), Author of Wechaty, [Microsoft Regional Director](https://rd.microsoft.com/en-us/huan-li), zixia@zixia.net

[![Profile of Huan LI (李卓桓) on StackOverflow](https://stackexchange.com/users/flair/265499.png)](https://stackexchange.com/users/265499)

## Copyright & License

- Docs released under Creative Commons
- Code released under the Apache-2.0 License
- Code & Docs © 2021 Huan LI \<zixia@zixia.net\>
