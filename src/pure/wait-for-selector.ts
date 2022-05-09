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
import {
  Observable,
  firstValueFrom,
  from,
}                 from 'rxjs'
import {
  filter,
  // eslint-disable-next-line import/extensions
}                 from 'rxjs/operators'
import type {
  State,
  Interpreter,
  StateSchema,
}                 from 'xstate'

const waitForSelector = async <T> (
  stream$: Observable<T>,
  selector: (x: T) => boolean,
): Promise<void> => {
  const future = firstValueFrom(
    stream$.pipe(
      filter(selector),
    ),
  )
  return future.then(() => undefined)
}

const waitForMachineState = async <TServiceCtlState extends StateSchema> (
  interpreter: Interpreter<
    any,
    TServiceCtlState,
    any
>,
  state: keyof TServiceCtlState['states'],
): Promise<void> => {
  const selector = (
    x: State<any, any, TServiceCtlState>,
  ) => x.value === state

  return waitForSelector(
    from(interpreter),
    selector,
  )
}

export {
  waitForSelector,
  waitForMachineState,
}
