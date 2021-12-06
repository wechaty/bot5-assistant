import {
  Message,
  types,
}                   from 'wechaty'

enum Intent {
  Unknown,
  Start,
  Stop,
}

const textToIntents = async (text: string): Promise<Intent[]> => {
  const intentList: Intent[] = []

  if (/^开始|start/i.test(text)) {
    intentList.push(Intent.Start)
  }

  if (/^停止|stop/i.test(text)) {
    intentList.push(Intent.Stop)
  }

  return intentList
}

const messageToIntents = async (message: Message): Promise<Intent[]> => {
  const intentList: Intent[] = []

  switch (message.type()) {
    case types.Message.Text:
      intentList.push(
        ...await textToIntents(message.text()),
      )
      break

    default:
      intentList.push(Intent.Unknown)
      break
  }

  return intentList
}

export {
  Intent,
  textToIntents,
  messageToIntents,
}
