enum Types {
  MESSAGE = 'bot5/MESSAGE',
  ROOM = 'bot5/ROOM',

  CONTACTS = 'bot5/CONTACTS',
  ADMINS = 'bot5/ADMINS',

  NO_AUDIO = 'bot5/NO_AUDIO',
  TEXT = 'bot5-assisstant/TEXT',

  MENTIONS = 'bot5/MENTIONS',
  NO_MENTION = 'bot5/NO_MENTION',

  NEXT = 'bot5/NEXT',

  START = 'bot5/START',
  STOP = 'bot5/STOP',

  SAY = 'bot5/SAY',
  RESET = 'bot5/RESET',

  // WAKEUP = 'bot5/WAKEUP',
  GERROR = 'bot5/GERROR',

  FEEDBACKS = 'bot5/FEEDBACKS',
  FEEDBACK = 'bot5/FEEDBACK',

  /**
 * Complete v.s. Finish
 *  @see https://ejoy-english.com/blog/complete-vs-finish-similar-but-different/
   */
  FINISH = 'bot5/FINISH',
  COMPLETE = 'bot5/COMPLETE',

  /**
   * Abort v.s. Cancel
 *  @see https://stackoverflow.com/a/9838022/1123955
   */
  ABORT = 'bot5/ABORT',
  CANCEL = 'bot5/CANCEL',

  WECHATY = 'bot5/WECHATY',
  // WECHATY_ADDRESS = 'bot5/WECHATY_ADDRESS',

  DELIVER = 'bot5/DELIVER',
  INTENTS = 'bot5/INTENTS',

  INTRODUCE = 'bot5/INTROCUDUCE',
  REPORT = 'bot5/REPORT',

  IDLE = 'bot5/IDLE',
  CHECK = 'bot5/CHECK',

  PROCESS = 'bot5/PROCESS',
  PARSE = 'bot5/PARSE',
}

export {
  Types,
}
