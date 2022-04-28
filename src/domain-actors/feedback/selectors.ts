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
import type { Context } from './duckula.js'

export const contactNum   = (ctx: Context) => Object.keys(ctx.contacts).length
export const feedbackNum  = (ctx: Context) => Object.values(ctx.feedbacks).filter(Boolean).length
export const nextContact  = (ctx: Context) => Object.values(ctx.contacts).filter(c =>
  !Object.keys(ctx.feedbacks).includes(c.id),
)[0]
export const contactAfterNext   = (ctx: Context) => Object.values(ctx.contacts).filter(c =>
  !Object.keys(ctx.feedbacks).includes(c.id),
)[1]
