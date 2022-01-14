/* eslint-disable sort-keys */

import * as WECHATY from 'wechaty'
import { createFixture } from 'wechaty-mocker'

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

    // const mockContactList = [
    //   mockMary,
    //   mockMike,
    //   mocker.bot,
    //   mocker.player,
    // ]
    const contactList = [
      mary,
      mike,
      wechaty.bot,
      wechaty.player,
    ]

    const mockGroupRoom = mocker.mocker.createRoom({
      topic: contactList.map(c => c.name()).join(','),
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

export { bot5Fixtures }
