enum Types {
  MESSAGE = 'bot5-assistant/MESSAGE',
  ROOM = 'bot5-assistant/ROOM',

  CONTACTS = 'bot5-assistant/CONTACTS',
  ADMINS = 'bot5-assistant/ADMINS',

  NO_AUDIO = 'bot5-assistant/NO_AUDIO',
  TEXT = 'bot5-assisstant/TEXT',

  MENTIONS = 'bot5-assistant/MENTIONS',
  NO_MENTION = 'bot5-assistant/NO_MENTION',

  NEXT = 'bot5-assistant/NEXT',

  START = 'bot5-assistant/START',
  STOP = 'bot5-assistant/STOP',

  SAY = 'bot5-assistant/SAY',
  RESET = 'bot5-assistant/RESET',

  // WAKEUP = 'bot5-assistant/WAKEUP',
  ERROR = 'bot5-assistant/ERROR',
  // CHECK = 'bot5-assistant/CHECK',

  FEEDBACK = 'bot5-assistant/FEEDBACK',

  /**
 * Complete v.s. Finish
 *  @see https://ejoy-english.com/blog/complete-vs-finish-similar-but-different/
   */
  FINISH = 'bot5-assistant/FINISH',
  COMPLETE = 'bot5-assistant/COMPLETE',

  /**
   * Abort v.s. Cancel
 *  @see https://stackoverflow.com/a/9838022/1123955
   */
  ABORT = 'bot5-assistant/ABORT',
  CANCEL = 'bot5-assistant/CANCEL',

  WECHATY = 'bot5-assistant/WECHATY',
  WECHATY_ADDRESS = 'bot5-assistant/WECHATY_ADDRESS',

  DELIVER = 'bot5-assistant/DELIVER',


}

export {
  Types,
}
