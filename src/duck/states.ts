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
export const busy = 'bot5-assistant/busy'

export const meeting = 'bot5-assistant/meeting'
/**
 * Huan(202112): Recommended states transition for actors with Mailbox
 *  1. initializing / onDone: idle
 *  2. idle
 *    - RESET: resetting -> initializing
 *    - *: idle (make sure it's an external transition)
 */
export const initializing  = 'bot5-assistant/initializing'

export const unknown = 'bot5-assistant/unknown'

export const listening = 'bot5-assistant/listening'
export const thinking = 'bot5-assistant/thinking'
export const feedbacking = 'bot5-assistant/feedbacking'
export const feedbacked = 'bot5-assistant/feedbacked'
export const checking = 'bot5-assistant/checking'
export const validating = 'bot5-assistant/validating'

/**
 * Complete v.s. Finish
 *  @see https://ejoy-english.com/blog/complete-vs-finish-similar-but-different/
 */
export const completed  = 'bot5-assistant/completed'
export const completing = 'bot5-assistant/completing'
export const finished   = 'bot5-assistant/finished'
export const finishing  = 'bot5-assistant/finishing'

/**
 * Abort v.s. Cancel
 *  @see https://stackoverflow.com/a/9838022/1123955
 */
export const aborting = 'bot5-assistant/aborted'
export const canceled = 'bot5-assistant/canceled'

/**
 * Which one is better: errored v.s. failed?
 *  @see https://stackoverflow.com/questions/6323049/understanding-what-fault-error-and-failure-mean
 */
export const errored  = 'bot5-assistant/errored'
export const erroring = 'bot5-assistant/erroring'
export const failed   = 'bot5-assistant/failed'

export const starting  = 'bot5-assistant/starting'
export const stopping  = 'bot5-assistant/stopping'

export const resetting = 'bot5-assistant/resetting'

export const active = 'bot5-assistant/active'
export const inactive = 'bot5-assistant/inactive'

export const recognizing = 'bot5-assistant/recognizing'
export const recognized = 'bot5-assistant/recognized'

export const processing = 'bot5-assistant/processing'
export const delivering = 'bot5-assistant/delivering'

export const mentioning = 'bot5-assistant/mentioning'
export const registering = 'bot5-assistant/registering'
export const registered = 'bot5-assistant/registered'

export const saying = 'bot5-assistant/saying'
export const updating = 'bot5-assistant/updating'
export const confirming = 'bot5-assistant/confirming'
export const understanding = 'bot5-assistant/understanding'

export const introducing = 'bot5-assistant/introducing'
export const selecting = 'bot5-assistant/selecting'
export const scheduling = 'bot5-assistant/scheduling'
export const noticing = 'bot5-assistant/noticing'
export const reporting = 'bot5-assistant/reporting'
export const parsing = 'bot5-assistant/parsing'
export const loading = 'bot5-assistant/loading'

/**
 * 吐槽：https://www.sohu.com/a/222322905_509197
 */
export const brainstorming = 'bot5-assistant/brainstorming'
export const roasting = 'bot5-assistant/roasting'

/**
 * retrospect means: a review of the past
 * @link https://wikidiff.com/reminisce/retrospect
 */
export const retrospecting = 'bot5-assistant/retrospecting'

/**
 * Meeting related
 */
export const joining      = 'bot5-assistant/joining'
export const presenting   = 'bot5-assistant/presenting'
export const upgrading    = 'bot5-assistant/upgrading'
export const electing     = 'bot5-assistant/electing'
export const elected      = 'bot5-assistant/elected'
export const photoing     = 'bot5-assistant/photoing'
export const housekeeping = 'bot5-assistant/housekeeping'
export const summarizing  = 'bot5-assistant/summarizing'
export const summarized   = 'bot5-assistant/summarized'
export const chatting     = 'bot5-assistant/chatting'
export const drinking     = 'bot5-assistant/drinking'
export const pledging     = 'bot5-assistant/pledging'
export const announcing   = 'bot5-assistant/announcing'
export const responding   = 'bot5-assistant/responding'
