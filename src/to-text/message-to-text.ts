import {
  Message,
  types as WechatyTypes,
}                         from 'wechaty'

import { stt }  from './stt.js'

const messageToText = async (message?: null | Message): Promise<undefined | string> => {
  if (!message) {
    return undefined
  }

  switch (message.type()) {
    case WechatyTypes.Message.Text:
      return message.text()

    case WechatyTypes.Message.Audio: {
      const fileBox = await message.toFileBox()
      const text = stt(fileBox)
      return text
    }

    case WechatyTypes.Message.Url: {
      const urlLink = await message.toUrlLink()
      return `${urlLink.title() || ''} | ${urlLink.description() || ''}`
    }

    case WechatyTypes.Message.Image:
      // TODO: return image recognition result
      // eslint-disable-next-line no-fallthrough
    default:
      return undefined
  }
}

export {
  messageToText,
}
