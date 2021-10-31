import type { MachineOptions } from 'xstate'

import type {
  MeetingContext,
  MeetingEventSchema,
}                     from './machine-config.js'

interface MeetingServiceOptions {
  // actions: {
  //   onEntry: Function,
  //   onExit: Function,
  // },
  // services: {
  start:  () => Promise<void>,
  stop:   () => Promise<void>,
  // }
}

const buildMachineOptions = (
  options: MeetingServiceOptions,
): MachineOptions<
  MeetingContext,
  MeetingEventSchema
> => {
  const reset = async () => {
    await options.stop()
    await options.start()
  }

  return {
    actions: {
      // onEntry,
      // onExit,
    },
    activities: {},
    delays: {},
    guards: {},
    services: {
      reset,
      start : options.start,
      stop  : options.stop,
    },
  }
}

export type {
  MeetingServiceOptions,
}
export {
  buildMachineOptions,
}
