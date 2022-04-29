/**
 * Idle Time – Definition, Causes, And How To Reduce It
 *  @see https://limblecmms.com/blog/idle-time/
 */
export const Idle = 'bot5-assistant/Idle'
export const Busy = 'bot5-assistant/Busy'

export const meeting = 'bot5-assistant/Meeting'
/**
 * Huan(202112): Recommended states transition for actors with Mailbox
 *  1. initializing / onDone: idle
 *  2. idle
 *    - RESET: resetting -> initializing
 *    - *: idle (make sure it's an external transition)
 */
export const Initializing  = 'bot5-assistant/Initializing'
export const Initialized   = 'bot5-assistant/Initialized'

export const Unknown = 'bot5-assistant/Unknown'

export const Listening   = 'bot5-assistant/Listening'
export const Thinking    = 'bot5-assistant/Thinking'
export const Feedbacking = 'bot5-assistant/Feedbacking'
export const Feedbacked  = 'bot5-assistant/Feedbacked'
export const Checking    = 'bot5-assistant/Checking'
export const Validating  = 'bot5-assistant/Validating'

/**
 * Complete v.s. Finish
 *  @see https://ejoy-english.com/blog/complete-vs-finish-similar-but-different/
 */
export const Completed  = 'bot5-assistant/Completed'
export const Completing = 'bot5-assistant/Completing'
export const Finished   = 'bot5-assistant/Finished'
export const Finishing  = 'bot5-assistant/Finishing'

/**
 * Abort v.s. Cancel
 *  @see https://stackoverflow.com/a/9838022/1123955
 */
export const Aborting = 'bot5-assistant/Aborted'
export const Canceled = 'bot5-assistant/Canceled'

/**
 * Which one is better: errored v.s. failed?
 *  @see https://stackoverflow.com/questions/6323049/understanding-what-fault-error-and-failure-mean
 */
export const Errored  = 'bot5-assistant/Errored'
export const Erroring = 'bot5-assistant/Erroring'
export const Failed   = 'bot5-assistant/Failed'

export const Stopping  = 'bot5-assistant/Stopping'

export const Resetting = 'bot5-assistant/Resetting'
export const Resetted  = 'bot5-assistant/Resetted'

export const Active = 'bot5-assistant/Active'
export const Inactive = 'bot5-assistant/Inactive'

export const Recognizing  = 'bot5-assistant/Recognizing'
export const Recognized   = 'bot5-assistant/Recognized'

export const Classifying  = 'bot5-assisstant/Classifying'
export const Classified   = 'bot5-assistant/Classified'

export const Processing = 'bot5-assistant/Processing'
export const Delivering = 'bot5-assistant/Delivering'

export const Mentioning   = 'bot5-assistant/Mentioning'
export const Registering  = 'bot5-assistant/Registering'
export const Registered   = 'bot5-assistant/Registered'

export const Saying         = 'bot5-assistant/Saying'
export const Updating       = 'bot5-assistant/Updating'
export const Confirming     = 'bot5-assistant/Confirming'

export const Understanding  = 'bot5-assistant/Understanding'
export const Understood     = 'bot5-assistant/Understood'

export const Introducing  = 'bot5-assistant/Introducing'
export const Selecting    = 'bot5-assistant/Selecting'
export const Scheduling   = 'bot5-assistant/Scheduling'
export const Noticing     = 'bot5-assistant/Noticing'
export const Reporting    = 'bot5-assistant/Reporting'
export const Parsing      = 'bot5-assistant/Parsing'
export const Loading      = 'bot5-assistant/Loading'
export const Messaging    = 'bot5-assistant/Messaging'
export const Filing       = 'bot5-assistant/Filing'
export const Textualizing = 'bot5-assistant/Textualizing'
export const Nexting      = 'bot5-assistant/Nexting'

export const Responding   = 'bot5-assistant/Responding'
