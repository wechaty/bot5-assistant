import {
  actions,
}                 from 'xstate'

interface ContextLastOrigin {
  lastOrigin?: string,
}

const contextLastOrigin: ContextLastOrigin = {
  lastOrigin : undefined as undefined | string,
}

/**
 * Huan(202112): Workaround for xstate#2861
 *  @see https://github.com/statelyai/xstate/issues/2861
 *
 * @deprecated use `respond` whhen `xstate@5` is available, then remove this workaround
 */
const respondLastOrigin = <
  C extends ContextLastOrigin,
  E extends Parameters<typeof actions.send>[0],
>(event: E) => actions.send(
    event,
    {
      to: (
        ctx: C,
      ) => ctx.lastOrigin!,
    },
  )

const lastOrigin = (
  _: any,
  __: any,
  { _event }: any,
) => _event.origin

export {
  type ContextLastOrigin,
  contextLastOrigin,
  respondLastOrigin,
  lastOrigin,
}
