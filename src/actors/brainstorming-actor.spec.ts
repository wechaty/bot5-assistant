#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/* eslint-disable sort-keys */

import {
  test,
  sinon,
}                   from 'tstest'

import {
  AnyEventObject,
  interpret,
  createMachine,
  Interpreter,
  EventObject,
  // spawn,
  actions,
}                   from 'xstate'
import * as WECHATY from 'wechaty'
import {
  firstValueFrom,
  from,
}                   from 'rxjs'
import {
  filter,
  tap,
}                   from 'rxjs/operators'
import { createFixture } from 'wechaty-mocker'
import type { mock } from 'wechaty-puppet-mock'

import { inspect } from '@xstate/inspect/lib/server.js'
import { WebSocketServer } from 'ws'

import type * as Mailbox from '../mailbox/mod.js'

import {
  Events,
  States,
  Types,
}           from '../schemas/mod.js'

import {
  machineFactory,
  mailboxFactory,
}                   from './brainstorming-actor.js'

import { audioFixtures } from '../to-text/mod.js'
import { isMailboxType } from '../mailbox/types.js'

import { createBot5Injector } from '../ioc/ioc.js'
import { isActionOf } from 'typesafe-actions'

async function * bot5Fixtures () {
  for await (const WECHATY_FIXTURES of createFixture()) {
    const {
      mocker,
      wechaty,
    }           = WECHATY_FIXTURES

    const mockMary = mocker.mocker.createContact({ name: 'Mary' })
    const mockMike = mocker.mocker.createContact({ name: 'Mike' })

    const mary = (await wechaty.wechaty.Contact.find({ id: mockMary.id }))!
    const mike = (await wechaty.wechaty.Contact.find({ id: mockMike.id }))!

    const mockContactList = [
      mockMary,
      mockMike,
      mocker.bot,
      mocker.player,
    ]
    const contactList = [
      mary,
      mike,
      wechaty.bot,
      wechaty.player,
    ]

    const mockGroupRoom = mocker.mocker.createRoom({
      memberIdList: contactList.map(c => c.id),
    })
    const groupRoom = await wechaty.wechaty.Room.find({ id: mockGroupRoom.id })
    if (!groupRoom) {
      throw new Error('no meeting room')
    }

    const logger = (arg0: any, ...args: any[]) => {
      const arg0List = arg0.split(/\s+/)
      WECHATY.log.info(
        arg0List[0],
        [
          ...arg0List.slice(1),
          ...args,
        ].join(' '),
      )
    }

    yield {
      ...WECHATY_FIXTURES,
      mocker: {
        ...WECHATY_FIXTURES.mocker,
        mary: mockMary,
        mike: mockMike,
        groupRoom: mockGroupRoom,
      },

      wechaty: {
        ...WECHATY_FIXTURES.wechaty,
        mary,
        mike,
        groupRoom,
      },
      logger,
    } as const
  }
}

test('Brainstorming actor smoke testing', async t => {
  const server = new WebSocketServer({
    port: 8888
  })

  inspect({ server })

  for await (
    const {
      mocker: mockerFixture,
      wechaty: wechatyFixture,
      logger,
    } of bot5Fixtures()
  ) {
    const FEEDBACKS = {
      [mockerFixture.mary.id]: 'im mary',
      [mockerFixture.mike.id]: 'im mike',
      [mockerFixture.player.id]: audioFixtures.silk.text,
      [mockerFixture.bot.id]: 'im bot',
    }

    const injector = createBot5Injector({
      wechaty: wechatyFixture.wechaty,
      logger,
      devTools: true,
    })

    const mailbox = injector.injectFunction(mailboxFactory) as Mailbox.MailboxImpl

    const targetEventList: EventObject[] = []
    mailbox.debug.target.interpreter!.onEvent(e => targetEventList.push(e))

    const targetSnapshot = () => mailbox.debug.target.interpreter!.getSnapshot()
    const targetContext = () => targetSnapshot().context
    const targetState = () => targetSnapshot().value

    const proxyMachine = createMachine<any>({
      on: {
        '*': {
          actions: actions.choose([
            {
              cond: mailbox.address.condNotOrigin(),
              actions: mailbox.address.send((_, e) => e),
            },
          ]),
        },
      },
    })

    const proxyEventList: AnyEventObject[] = []
    const proxyInterpreter = interpret(proxyMachine)
      .onEvent(e => proxyEventList.push(e))
      .onTransition(s => {
        console.info('####  transition:', s.value, s.event.type)
        // console.info('event:', s.event.type)
      })
      .start()

    await new Promise(resolve => setTimeout(resolve, 15000))

    const messageList: WECHATY.Message[] = []
    wechatyFixture.wechaty.on('message', async msg => {
      messageList.push(msg)
      console.info('XXX wechaty.wechaty.on(message)', String(msg))

      if (msg.self()) {
        return
      }
      proxyInterpreter.send(
        Events.MESSAGE(msg),
      )
    })

    proxyInterpreter.send(Events.ROOM(wechatyFixture.groupRoom))
    t.equal(
      targetContext().room.id,
      wechatyFixture.groupRoom.id,
      'should set room to context',
    )
    t.equal(targetState(), States.registering, 'should in state.registering')

    mockerFixture.player.say('hello, no mention to anyone', []).to(mockerFixture.groupRoom)
    await new Promise(setImmediate)
    t.equal(targetState(), States.registering, 'should in state.registering if no mention')

    // console.info('eventList', eventList)

    proxyEventList.length = 0
    /**
     * Send MESSAGE event
     */
    mockerFixture.player
      .say('register mary & mike by mention them', [
        mockerFixture.mary,
        mockerFixture.mike,
      ])
      .to(mockerFixture.groupRoom)
    await new Promise(setImmediate)
    t.same(
      targetContext().contacts.map(c => c.id),
      [
        mockerFixture.mary.id,
        mockerFixture.mike.id,
      ],
      'should set contacts to mary, mike',
    )
    t.equal(targetState(), States.feedbacking, 'should in state.feedbacking')

    mockerFixture.mary
      .say(FEEDBACKS[mockerFixture.mary.id])
      .to(mockerFixture.groupRoom)
    await new Promise(setImmediate)
    t.same(
      targetContext().feedbacks,
      {},
      'should no feedbacks because it will updated only all members have replied',
    )
    t.equal(targetState(), States.feedbacking, 'should in state.feedbacking')

    mockerFixture.mike
      .say(FEEDBACKS[mockerFixture.mike.id])
      .to(mockerFixture.groupRoom)
    await new Promise(setImmediate)
    t.same(
      targetContext().feedbacks,
      {
        [mockerFixture.mary.id] : FEEDBACKS[mockerFixture.mary.id],
        [mockerFixture.mike.id] : FEEDBACKS[mockerFixture.mike.id],
      },
      'should get feedbacks because it will updated only all members have replied',
    )
    t.equal(targetState(), States.finished, 'should in state.feedbacking')

    // const EXPECTED_FEEDBACKS = {
    //   [mary.id]          : FIXTURES.feedbacks.mary,
    //   [mocker.bot.id]    : FIXTURES.feedbacks.bot,
    //   [mike.id]          : FIXTURES.feedbacks.mike,
    //   [mocker.player.id] : FIXTURES.feedbacks.player,
    // }

    // const msg = await listenMessage(() => mary.say(FIXTURES.feedbacks.mike).to(mockMeetingRoom))
    // interpreter.send(Events.MESSAGE(msg))
    // eventList.length = 0
    // await firstValueFrom(
    //   from(interpreter).pipe(
    //     tap(x => console.info('tap event:', x.event.type)),
    //     filter(s => s.event.type === Types.FEEDBACK),
    //   ),
    // )
    // t.same(
    //   eventList,
    //   [
    //     Events.FEEDBACK({
    //       ...EXPECTED_FEEDBACKS,
    //       [mary.id] : FIXTURES.feedbacks.mike,
    //     }),
    //   ],
    //   'should get FEEDBACKS event immediately after mary said mike feedback once again',
    // )
    // interpreter.stop()

    console.info('Room message log:')
    for (const msg of messageList) {
      const mentionText = (await msg.mentionList())
        .map(c => '@' + c.name()).join(' ')

      console.info(
        '-------\n',
        msg.talker().name(),
        ':',
        mentionText,
        msg.text(),
      )
    }

    await new Promise(resolve => setTimeout(resolve, 50000))
  }

  // server.close()
})
