const idle = 'bot5-assitant/idle'
const listening = 'bot5-assitant/listening'
const thinking = 'bot5-assitant/thinking'
const feedbacking = 'bot5-assitant/feedbacking'
const feedbacked = 'bot5-assitant/feedbacked'
const checking = 'bot5-assitant/checking'
const validating = 'bot5-assitant/validating'

const active = 'bot5-assitant/active'
const inactive = 'bot5-assitant/inactive'

/**
 * Complete v.s. Finish
 *  @see https://ejoy-english.com/blog/complete-vs-finish-similar-but-different/
 */
const completed = 'bot5-assitant/completed'
const finished = 'bot5-assitant/finished'

/**
 * Abort v.s. Cancel
 *  @see https://stackoverflow.com/a/9838022/1123955
 */
const aborting = 'bot5-assitant/aborted'
const canceled = 'bot5-assitant/canceled'

/**
 * Which one is better: errored v.s. failed?
 *  @see https://stackoverflow.com/questions/6323049/understanding-what-fault-error-and-failure-mean
 */
const errored = 'bot5-assitant/errored'
const failed = 'bot5-assitant/failed'

const resetting = 'bot5-assitant/resetting'

const recognizing = 'bot5-assistant/recognizing'
const processing = 'bot5-assistant/processing'

export {
  active,
  inactive,
  resetting,

  aborting,
  canceled,
  errored,
  failed,

  checking,
  completed,
  finished,
  idle,
  listening,
  thinking,

  feedbacking,
  feedbacked,

  validating,
  recognizing,
  processing,
}
