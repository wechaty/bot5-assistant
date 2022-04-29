/**
 *   Wechaty Open Source Software - https://github.com/wechaty
 *
 *   @copyright 2022 Huan LI (李卓桓) <https://github.com/huan>, and
 *                   Wechaty Contributors <https://github.com/wechaty>.
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 *
 */

/**
 * Idle Time – Definition, Causes, And How To Reduce It
 *  @see https://limblecmms.com/blog/idle-time/
 */
export const Idle = 'bot5-assistant/Idle'
export const Busy = 'bot5-assistant/Busy'

/**
 * Huan(202112): Recommended states transition for actors with Mailbox
 *  1. initializing / onDone: idle
 *  2. idle
 *    - RESET: resetting -> initializing
 *    - *: idle (make sure it's an external transition)
 */
export const Initializing  = 'bot5-assistant/Initializing'
export const Initialized   = 'bot5-assistant/Initialized'

export const Responding = 'bot5-assistant/Responding'
export const Responded  = 'bot5-assistant/Responded'

/**
 * Which one is better: errored v.s. failed?
 *  @see https://stackoverflow.com/questions/6323049/understanding-what-fault-error-and-failure-mean
 */
export const Erroring = 'bot5-assistant/Erroring'
export const Errored  = 'bot5-assistant/Errored'

export const Failing  = 'bot5-assistant/Failing'
export const Failed   = 'bot5-assistant/Failed'

/**
 * Start / Stop
 */
export const Starting = 'bot5-assistant/Starting'
export const Started  = 'bot5-assistant/Started'

export const Stopping = 'bot5-assistant/Stopping'
export const Stopped  = 'bot5-assistant/Stopped'

export const Resetting = 'bot5-assistant/Resetting'
export const Resetted  = 'bot5-assistant/Resetted'

/**
 * Complete v.s. Finish
 *  @see https://ejoy-english.com/blog/complete-vs-finish-similar-but-different/
 */
export const Completing = 'bot5-assistant/Completing'
export const Completed  = 'bot5-assistant/Completed'

export const Finishing  = 'bot5-assistant/Finishing'
export const Finished   = 'bot5-assistant/Finished'

/**
 * Abort v.s. Cancel
 *  @see https://stackoverflow.com/a/9838022/1123955
 */
export const Aborting = 'bot5-assistant/Aborting'
export const Aborted  = 'bot5-assistant/Aborted'

export const Canceling = 'bot5-assistant/Canceling'
export const Canceled = 'bot5-assistant/Canceled'
