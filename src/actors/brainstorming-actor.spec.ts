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
import { isActionOf } from 'typesafe-actions'

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

    const mary = mocker.mocker.createContact({ name: 'Mary' })
    const mike = mocker.mocker.createContact({ name: 'Mike' })

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

    const mailbox = injector.injectFunction(mailboxFactory) as Mailbox.MailboxImpl

    const targetEventList: EventObject[] = []
    mailbox.debug.target.interpreter!.onEvent(e => targetEventList.push(e))

    const actorMachine = createMachine<any>({
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

    const actorEventList: AnyEventObject[] = []
    const actorInterpreter = interpret(actorMachine)
      .onEvent(e => actorEventList.push(e))
      .onTransition(s => {
        console.info('####  transition:', s.value, s.event.type)
        // console.info('event:', s.event.type)
      })
      .start()

    const messageList: WECHATY.Message[] = []
    wechaty.wechaty.on('message', async msg => {
      messageList.push(msg)
      console.info('XXX wechaty.wechaty.on(message)', String(msg))
      if (msg.self()) {
        return
      }
      actorInterpreter.send(
        Events.MESSAGE(msg),
      )
    })

    actorInterpreter.send(Events.ROOM(FIXTURES.room))
    let targetSnapshot = mailbox.debug.target.interpreter!.getSnapshot()
    t.equal(
      targetSnapshot.context.room.id,
      FIXTURES.room.id,
      'should set room to context',
    )
    t.equal(targetSnapshot.value, States.registering, 'should in state.registering')


    mocker.player.say('hello, no mention to anyone', []).to(mockMeetingRoom)
    await new Promise(setImmediate)
    targetSnapshot = mailbox.debug.target.interpreter!.getSnapshot()
    t.equal(targetSnapshot.value, States.registering, 'should in state.registering if no mention')

    // console.info('eventList', eventList)

    actorEventList.length = 0
    /**
     * Send MESSAGE event
     */
    mocker.player.say(FIXTURES.feedbacks.player, [mary, mike]).to(mockMeetingRoom)
    await new Promise(setImmediate)
    targetSnapshot = mailbox.debug.target.interpreter!.getSnapshot()
    t.same(
      targetSnapshot.context.contacts.map(c => c.id),
      [mary.id, mike.id],
      'should set contacts to mary, mike',
    )
    t.equal(targetSnapshot.value, States.feedbacking, 'should in state.feedbacking')

    mary.say(FIXTURES.feedbacks.mary).to(mockMeetingRoom)
    await new Promise(setImmediate)
    targetSnapshot = mailbox.debug.target.interpreter!.getSnapshot()
    t.same(
      targetSnapshot.context.feedbacks,
      {},
      'should no feedbacks because it will updated only all members have replied',
    )
    t.equal(targetSnapshot.value, States.feedbacking, 'should in state.feedbacking')

    mike.say(FIXTURES.feedbacks.mike).to(mockMeetingRoom)
    await new Promise(setImmediate)
    targetSnapshot = mailbox.debug.target.interpreter!.getSnapshot()
    t.same(
      targetSnapshot.context.feedbacks,
      {
        [mary.id] : FIXTURES.feedbacks.mary,
        [mike.id] : FIXTURES.feedbacks.mike,
      },
      'should get feedbacks because it will updated only all members have replied',
    )
    t.equal(targetSnapshot.value, States.finished, 'should in state.feedbacking')

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
  }
})
