enum States {
  /**
   * Idle Time – Definition, Causes, And How To Reduce It
   *  @see https://limblecmms.com/blog/idle-time/
   */
  idle = 'bot5-assitant/idle',
  busy = 'bot5-assisstant/busy',

  unknown = 'bot5-assisstant/unknown',

  listening = 'bot5-assitant/listening',
  thinking = 'bot5-assitant/thinking',
  feedbacking = 'bot5-assitant/feedbacking',
  feedbacked = 'bot5-assitant/feedbacked',
  checking = 'bot5-assitant/checking',
  validating = 'bot5-assitant/validating',

  /**
   * Complete v.s. Finish
   *  @see https://ejoy-english.com/blog/complete-vs-finish-similar-but-different/
   */
  completed  = 'bot5-assitant/completed',
  completing = 'bot5-assitant/completing',
  finished   = 'bot5-assitant/finished',
  finishing  = 'bot5-assitant/finishing',

  /**
   * Abort v.s. Cancel
   *  @see https://stackoverflow.com/a/9838022/1123955
   */
  aborting = 'bot5-assitant/aborted',
  canceled = 'bot5-assitant/canceled',

  /**
   * Which one is better: errored v.s. failed?
   *  @see https://stackoverflow.com/questions/6323049/understanding-what-fault-error-and-failure-mean
   */
  errored = 'bot5-assitant/errored',
  failed = 'bot5-assitant/failed',

  /**
   * Huan(202112): Recommended states transition for actors with Mailbox
   *  1. initial: initializing / onDone: inactive
   *  2. start/stop:
   *    2.1 START: starting / onDone: active (validating might be required)
   *    2.2 STOP: stopping / onDone: inactive
   *  3. RESET: resetting
   *  4. ABORT: ???
   */
  initializing  = 'bot5-assitant/initializing',
  starting  = 'bot5-assitant/starting',
  stopping  = 'bot5-assitant/stopping',

  resetting = 'bot5-assitant/resetting',

  active = 'bot5-assitant/active',
  inactive = 'bot5-assitant/inactive',

  recognizing = 'bot5-assistant/recognizing',
  recognized = 'bot5-assistant/recognized',

  processing = 'bot5-assistant/processing',
  delivering = 'bot5-assistant/delivering',

  mentioning = 'bot5-assistant/mentioning',
  registering = 'bot5-assistant/registering',
  registered = 'bot5-assistant/registered',
}

export {
  States,
}
