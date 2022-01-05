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

import * as Mailbox from '../mailbox/mod.js'

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

const awaitMessageWechaty = (wechaty: WECHATY.Wechaty) => (sayFn: () => any) => {
  const future = new Promise<WECHATY.Message>(resolve => wechaty.once('message', resolve))
  sayFn()
  return future
}

const nullMachine = createMachine<{}>({})
const nullInterpreter = interpret(nullMachine)

test('Brainstorming actor smoke testing', async t => {
  for await (const WECHATY_FIXTURES of createFixture()) {
    const {
      mocker,
      wechaty,
    }           = WECHATY_FIXTURES

    const listenMessage = awaitMessageWechaty(wechaty.wechaty)

    const [mary, mike] = mocker.mocker.createContacts(2) as [mock.ContactMock, mock.ContactMock]

    const MEMBER_ID_LIST = [
      mary.id,
      mike.id,
      mocker.bot.id,
      mocker.player.id,
    ]
    const mockMeetingRoom = mocker.mocker.createRoom({
      memberIdList: MEMBER_ID_LIST,
    })

    const MEMBER_LIST = (await Promise.all(
      MEMBER_ID_LIST.map(id => wechaty.wechaty.Contact.find({ id })),
    )).filter(Boolean) as WECHATY.Contact[]

    const rename = async (contactId: string, name: string) => wechaty.wechaty.Contact.find({ id: contactId }).then(contact => (contact as any)._payload.name = name)
    rename(mary.id, 'Mary')
    rename(mike.id, 'Mike')
    rename(wechaty.player.id, 'Player')
    rename(wechaty.bot.id, 'Bot')

    const MEETING_ROOM = await wechaty.wechaty.Room.find({ id: mockMeetingRoom.id })
    if (!MEETING_ROOM) {
      throw new Error('no meeting room')
    }

    const SILK = audioFixtures.silk

    const FIXTURES = {
      room: MEETING_ROOM,
      members: MEMBER_LIST,
      feedbacks: {
        mary: 'im mary',
        mike: 'im mike',
        player: SILK.text,
        bot: 'im bot',
      },
    }

    const injector = createBot5Injector({
      wechaty: wechaty.wechaty,
      logger: (...args: any[]) => WECHATY.log.verbose(args.join(' ')),
    })

    const mailbox = injector.injectFunction(mailboxFactory)

    const testMachine = createMachine<any>({
      on: {
        '*': {
          actions: mailbox.address.send((_: any, e: EventObject) => e),
        }
      }
    })


    const eventList: AnyEventObject[] = []

    const interpreter = interpret(testMachine)
      .onEvent(e => eventList.push(e))
      .onTransition(s => {
        console.info('  transition:', s.value, s.event.type)
        // console.info('event:', s.event.type)
      })
      .start()

    wechaty.wechaty.on('message', msg => {
      console.info('- [wechaty message]:', msg._payload)
      console.info('- [wechaty message talker]:', msg.talker()?.name())
      if (msg.self()) {
        return
      }
      interpreter.send(
        Events.MESSAGE(msg),
      )
    })

    interpreter.send(Events.ROOM(FIXTURES.room))

    console.info(eventList)

    eventList.length = 0
    /**
     * Send MESSAGE event
     */
    ;[
      await listenMessage(() => mary.say(FIXTURES.feedbacks.mary).to(mockMeetingRoom)),
      // await listenMessage(() => mike.say(FIXTURES.feedbacks.mike).to(mockMeetingRoom)),
      // await listenMessage(() => mocker.bot.say(FIXTURES.feedbacks.bot).to(mockMeetingRoom)),
      // await listenMessage(() => mocker.player.say(FIXTURES.feedbacks.player).to(mockMeetingRoom)),
    ]
      .map(Events.MESSAGE)
      .forEach(e => interpreter.send(e))
    t.same(
      eventList.map(e => e.type),
      Array(4).fill(Types.MESSAGE),
      'should get 4 message events',
    )

    // eventList.length = 0
    // // eventList.forEach(e => console.info(e))
    // await firstValueFrom(
    //   from(interpreter).pipe(
    //     // tap(x => console.info('tap event:', x.event.type)),
    //     filter(s => s.event.type === Types.FEEDBACK),
    //   ),
    // )
    // const EXPECTED_FEEDBACKS = {
    //   [mary.id]          : FIXTURES.feedbacks.mary,
    //   [mocker.bot.id]    : FIXTURES.feedbacks.bot,
    //   [mike.id]          : FIXTURES.feedbacks.mike,
    //   [mocker.player.id] : FIXTURES.feedbacks.player,
    // }
    // t.same(
    //   eventList,
    //   [
    //     Events.FEEDBACK(EXPECTED_FEEDBACKS),
    //   ],
    //   'should get FEEDBACKS event',
    // )

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
  }
})
