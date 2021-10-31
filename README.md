# BOT5 Club Assistant Bot Plugin

[![NPM Version](https://img.shields.io/npm/v/wechaty-bot5-assistant?color=brightgreen)](https://www.npmjs.com/package/wechaty-bot5-assistant)
[![NPM](https://github.com/wechaty/bot5-assistant/workflows/NPM/badge.svg)](https://github.com/wechaty/bot5-assistant/actions?query=workflow%3ANPM)
[![Powered by Wechaty](https://img.shields.io/badge/Powered%20By-Wechaty-brightgreen.svg)](https://github.com/Wechaty/wechaty)

BOT5 Meeting Assistant BOT powered by Wechaty.

![BOT5 Club](docs/images/caq-bot5-qingyu.webp)

## Get Start

### Step 1: Install

```sh
npm install wechaty-bot5-assistant --save
```

### Step 2: Make a bot

```sh
$ vim mybot.js

import { WechatyBuilder } from 'wechaty'
import { Bot5Assistant } from 'wechaty-bot5-assistant'

const bot = WechatyBuilder.build()

bot.use(Bot5Assistant({
  room: [
    /^BOT5/,
  ]
}))
.on('scan', (url, code) => console.log(`Scan QR Code to login: ${code}\n${url}`))
.on('login', user => console.log(`User ${user} logged in`))
.start()
```

### Step 3: Run

```sh
node mybot.js
```

## Options

```ts
const DEFAULT_CONFIG = {
  // Which room(s) you want the bot to work with.
  // Can be a RegExp (for topic) or a function (filter room instance)
  // E.g. room: function (room) { room.topic().indexOf('我的') > -1 }
  room: [/BOT5/i, 'room_id@chatroom'],
}
```

## Finate State Machine (FSM)

It's a finite state machine, which means it has a finite number of states.

> Huan(202110): the above line is suggested by GitHub Pilot.

We are trying to use [XState](https://xstate.js.org/) to implement the FSM and using FSM to manage our meeting state transitions.

Currently we are just getting started, you can learn more about the BOT5 Club Meeting FSM at <https://wechaty.github.io/bot5-assistant/>

## History

### master v0.2 (Oct 29, 2021)

1. Code init in Bot Friday Club meeting
1. Code clean for integrating with [Friday BOT](https://github.com/wechaty/friday)

## Author

- [@caq](https://github.com/caq), [Anqi CUI](http://me.caq9.info/), Co-founder & Chief AI Officer of [RSVP.ai](https://rsvp.ai/)
- [@huan](https://github.com/huan), Huan LI, Founding chairman of [BOT5 Club](https://bot5.ml), author of [Wechaty](https://wechaty.js.org)

## Reference

- [Wechaty](https://github.com/wechaty/wechaty)

## Copyright & License

- Code & Docs © 2021-now Wechaty Contributors
- Code released under the Apache-2.0 License
- Docs released under Creative Commons
