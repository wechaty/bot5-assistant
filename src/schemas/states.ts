enum States {
  /**
   * Idle Time – Definition, Causes, And How To Reduce It
   *  @see https://limblecmms.com/blog/idle-time/
   */
  idle = 'bot5/idle',
  busy = 'bot5-assisstant/busy',

  /**
   * Huan(202112): Recommended states transition for actors with Mailbox
   *  1. initializing / onDone: idle
   *  2. idle
   *    - RESET: resetting -> initializing
   *    - *: idle (make sure it's an external transition)
   */
  initializing  = 'bot5/initializing',

  unknown = 'bot5-assisstant/unknown',

  listening = 'bot5/listening',
  thinking = 'bot5/thinking',
  feedbacking = 'bot5/feedbacking',
  feedbacked = 'bot5/feedbacked',
  checking = 'bot5/checking',
  validating = 'bot5/validating',

  /**
   * Complete v.s. Finish
   *  @see https://ejoy-english.com/blog/complete-vs-finish-similar-but-different/
   */
  completed  = 'bot5/completed',
  completing = 'bot5/completing',
  finished   = 'bot5/finished',
  finishing  = 'bot5/finishing',

  /**
   * Abort v.s. Cancel
   *  @see https://stackoverflow.com/a/9838022/1123955
   */
  aborting = 'bot5/aborted',
  canceled = 'bot5/canceled',

  /**
   * Which one is better: errored v.s. failed?
   *  @see https://stackoverflow.com/questions/6323049/understanding-what-fault-error-and-failure-mean
   */
  errored  = 'bot5/errored',
  erroring = 'bot5/erroring',
  failed   = 'bot5/failed',

  starting  = 'bot5/starting',
  stopping  = 'bot5/stopping',

  resetting = 'bot5/resetting',

  active = 'bot5/active',
  inactive = 'bot5/inactive',

  recognizing = 'bot5/recognizing',
  recognized = 'bot5/recognized',

  processing = 'bot5/processing',
  delivering = 'bot5/delivering',

  mentioning = 'bot5/mentioning',
  registering = 'bot5/registering',
  registered = 'bot5/registered',

  saying = 'bot5/saying',
  updating = 'bot5/updating',
  confirming = 'bot5/confirming',
  understanding = 'bot5/understanding',

  introducing = 'bot5/introducing',
  selecting = 'bot5/selecting',
  scheduling = 'bot5/scheduling',
  noticing = 'bot5/noticing',
  reporting = 'bot5/reporting',
  parsing = 'bot5/parsing',
}

export {
  States,
}
