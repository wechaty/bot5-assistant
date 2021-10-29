# Wechaty VoteOut Plugin

[![NPM Version](https://img.shields.io/npm/v/wechaty-voteout?color=brightgreen)](https://www.npmjs.com/package/wechaty-voteout)
[![NPM](https://github.com/Gcaufy/wechaty-voteout/workflows/NPM/badge.svg)](https://github.com/Gcaufy/wechaty-voteout/actions?query=workflow%3ANPM)
[![Wechaty Plugin Contrib](https://img.shields.io/badge/Wechaty%20Plugin-VoteOut-brightgreen.svg)](https://github.com/Gcaufy/wechaty-voteout)
[![Powered by Wechaty](https://img.shields.io/badge/Powered%20By-Wechaty-brightgreen.svg)](https://github.com/Wechaty/wechaty)

Wechaty VoteOut Plugin can help you to have a vote and kick-out feature for you room.

![ScreenShot](https://user-images.githubusercontent.com/2182004/80809484-5d311400-8bf4-11ea-95c6-39426730067c.png)

## Get Start

### Step 1: Install

```sh
npm install wechaty-voteout --save
```

### Step 2: Make a bot

```sh
$ vim mybot.js

import { Wechaty } from 'wechaty'
import { Bot5Assistant } from 'wechaty-bot5-assistant'

const bot = Wechaty.instance()

bot.use(Bot5Assistant({ /* options */ }))
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
  room: [/Room Topic 1/i, 'room_id@chatroom'],
}
```

## History

### master v0.1 (Oct 29, 2021)

1. Code init

## Maintainers

@huan

## Author

@caq

## Reference

* [Wechaty](https://github.com/wechaty/wechaty)
