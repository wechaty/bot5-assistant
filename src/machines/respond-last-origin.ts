import {
  actions,
}                 from 'xstate'

interface ContextLastOrigin {
  lastOrigin?: string,
}

const contextLastOrigin: ContextLastOrigin = {
  lastOrigin : undefined as undefined | string,
}

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
