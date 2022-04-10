/* eslint-disable no-redeclare */
/* eslint-disable sort-keys */
import { actions, createMachine }   from 'xstate'
import type * as PUPPET             from 'wechaty-puppet'
import { GError }                   from 'gerror'
import * as Mailbox                 from 'mailbox'

import * as duck            from '../duck/mod.js'
import { messageToText }    from '../to-text/mod.js'

import * as actors  from './mod.js'

const Type = {
  CONTACTS : duck.Type.CONTACTS,
  FEEDBACK : duck.Type.FEEDBACK,
  GERROR   : duck.Type.GERROR,
  IDLE     : duck.Type.IDLE,
  MESSAGE  : duck.Type.MESSAGE,
  PROCESS  : duck.Type.PROCESS,
  REPORT   : duck.Type.REPORT,
  RESET    : duck.Type.RESET,
} as const

type Type = typeof Type[keyof typeof Type]

const EventConfig = {
  ADMINS   : duck.Event.ADMINS,
  CONTACTS : duck.Event.CONTACTS,
  RESET    : duck.Event.RESET,
} as const

const EventRequest = {
  MESSAGE  : duck.Event.MESSAGE,
  REPORT   : duck.Event.REPORT,
} as const

const EventResponse = {
  FEEDBACKS: duck.Event.FEEDBACKS,
}

const EventInternal = {
  FEEDBACK : duck.Event.FEEDBACK,
  GERROR   : duck.Event.GERROR,
  IDLE     : duck.Event.IDLE,
  NEXT     : duck.Event.NEXT,
  PROCESS  : duck.Event.PROCESS,
} as const

const Event = {
  ...EventConfig,
  ...EventRequest,
  ...EventResponse,
  ...EventInternal,
} as const

type Event = {
  [key in keyof typeof Event]: ReturnType<typeof Event[key]>
}

const State = {
  Feedbacking  : duck.State.feedbacking,
  Idle         : duck.State.Idle,
  Initializing : duck.State.initializing,
  Parsing      : duck.State.parsing,
  Processing   : duck.State.processing,
  Registering  : duck.State.registering,
  Reporting    : duck.State.reporting,
} as const

type State = typeof State[keyof typeof State]

type Context = {
  admins    : { [id: string]: PUPPET.payloads.Contact }
  contacts  : { [id: string]: PUPPET.payloads.Contact }
  feedbacks : { [id: string]: string }
  address: {
    noticing: string,
    registing: string,
  },
}

const ctxContactNum   = (ctx: Context) => Object.keys(ctx.contacts).length
const ctxFeedbackNum  = (ctx: Context) => Object.values(ctx.feedbacks).filter(Boolean).length
const ctxNextContact  = (ctx: Context) => Object.values(ctx.contacts).filter(c =>
  !Object.keys(ctx.feedbacks).includes(c.id),
)[0]
const ctxContactAfterNext   = (ctx: Context) => Object.values(ctx.contacts).filter(c =>
  !Object.keys(ctx.feedbacks).includes(c.id),
)[1]

function initialContext (): Pick<Context, 'contacts' | 'feedbacks'> {
  const context = {
    contacts  : {},
    feedbacks : {},
  }
  return JSON.parse(JSON.stringify(context)) as typeof context
}

const ID = 'FeedbackMachine'

const machine = createMachine<Context, Event[keyof Event]>({
  id: ID,
  /**
   * Issue statelyai/xstate#2891:
   *  The context provided to the expr inside a State
   *  should be exactly the **context in this state**
   * @see https://github.com/statelyai/xstate/issues/2891
   */
  preserveActionOrder: true,
  initial: State.Initializing,
  states: {
    [State.Initializing]: {
      always: State.Idle,
    },
    [State.Idle]: {
      entry: [
        Mailbox.actions.idle(ID)('idle'),
      ],
      on: {
        /**
         * Huan(202112):
         *  Every EVENTs received in state.idle must have a `target` to make sure it is a `external` event.
         *  so that the Mailbox.actions.idle() will be triggered and let the Mailbox knowns it's ready to process next message.
         */
        '*': State.Idle,
        [Type.RESET]: {
          actions: [
            actions.log('State.Idle.on.RESET', ID),
            actions.assign(ctx => ({
              ...ctx,
              ...initialContext(),
            })),
          ],
          target: State.Initializing,
        },

        [Type.CONTACTS]: {
          actions: [
            actions.assign({
              contacts: (_, e) => e.payload.contacts.reduce((acc, cur) => ({
                ...acc,
                [cur.id]: cur,
              }), {}),
            }),
          ],
          target: State.Idle,
        },

        [Type.REPORT]: {
          actions: [
            actions.log('State.Idle.on.REPORT', ID),
          ],
          target: State.Processing,
        },
        [Type.MESSAGE]: {
          actions: [
            actions.log('State.Idle.on.MESSAGE', ID),
          ],
          target: State.Parsing,
        },
      },
    },
    [State.Parsing]: {
      entry: [
        actions.log('State.Parsing.entry', ID),
      ],
      invoke: {
        src: (ctx) => messageToText(ctx.message),
        onDone: {
          actions: actions.send((ctx, e) =>
            Event.FEEDBACK(ctx.message!.talker().id, e.data),
          ),
        },
        onError: {
          actions: actions.send((_, e) => {
            // console.info(e.data)
            return Event.GERROR(GError.stringify(e.data))
          }),
        },
      },
      on: {
        [Type.FEEDBACK]: {
          actions: actions.log('State.parsing.on.FEEDBACK', ID),
          target: State.Feedbacking,
        },
        [Type.GERROR]: {
          actions: [
            actions.log('State.parsing.on.GERROR', ID),
            Mailbox.actions.reply((_, e) => Event.GERROR((e as ReturnType<typeof Event.GERROR>).payload.gerror)),
          ],
          target: State.Idle,
        },
      },
    },
    [State.Feedbacking]: {
      entry: [
        actions.log((_, e) => `State.feedbacking.entry <- [FEEDBACK(${(e as ReturnType<typeof Event.FEEDBACK>).payload.contactId}, "${(e as ReturnType<typeof Event.FEEDBACK>).payload.feedback}")`, ID),
        actions.assign({
          feedbacks: (ctx, e) => ({
            ...ctx.feedbacks,
            [(e as ReturnType<typeof Event.FEEDBACK>).payload.contactId]: (e as ReturnType<typeof Event.FEEDBACK>).payload.feedback,
          }),
        }),
        wechatyAddress.send((ctx, e) => actors.wechaty.Event.SAY(
          [
            '【反馈系统】',
            `收到${ctx.message!.talker().name()}的反馈：`,
            `“${(e as ReturnType<typeof Event.FEEDBACK>).payload.feedback}”`,
          ].join(''),
          ctx.message!.room()!.id,
        )),
        actions.choose<Context, any>([
          {
            cond: ctx => !!ctxNextContact(ctx),
            actions: [
              wechatyAddress.send(ctx => actors.wechaty.events.SAY(
                [
                  '【反馈系统】',
                  `下一位：@${ctxNextContact(ctx)?.name()}`,
                  ctxContactAfterNext(ctx)?.name() ? `。（请@${ctxContactAfterNext(ctx)?.name()}做准备）` : '',
                ].join(''),
                ctx.message!.room()!.id,
                !ctxContactAfterNext(ctx)
                  ? [ ctxNextContact(ctx)!.id ]
                  : [ ctxNextContact(ctx)!.id, ctxContactAfterNext(ctx)!.id ],
              )),
              actions.send(_ => Event.PROCESS()),
            ],
          },
          {
            actions: [
              wechatyAddress.send(ctx => actors.wechaty.Event.SAY(
                '【反馈系统】：已完成收集所有人反馈',
                ctx.message!.room()!.id,
              )),
              actions.send(_ => Event.PROCESS()),
            ],
          },
        ]),
      ],
      on: {
        [Type.PROCESS]:  State.Processing,
        [Type.IDLE]:     State.Idle,
      },
    },
    [State.Registering]: {
      entry: [
        actions.log('State.registering.entry', ID),
        registerAddress.send(Event.REPORT),
      ],
      on: {
        [Type.MESSAGE]: {
          actions: [
            registerAddress.send((_, e) => e),
          ],
        },
        [Type.CONTACTS]: {
          actions: [
            actions.assign({
              contacts: (_, e) => e.payload.contacts,
            }),
          ],
          target: State.Processing,
        },
      },
    },
    [State.Processing]: {
      entry: actions.log('State.processing.entry', ID),
      always: [
        {
          cond: ctx => ctxContactNum(ctx) <= 0,
          actions:[
            actions.log('State.processing.always -> registering because no contacts', ID),
          ],
          target: State.Registering,
        },
        {
          target: State.Reporting,
          actions: actions.log('State.processing.always -> reporting', ID),
        },
      ],
    },
    [State.Reporting]: {
      entry: [
        actions.log(ctx => `State.reporting.entry feedbacks/contacts(${ctxFeedbackNum(ctx)}/${ctxContactNum(ctx)})`, ID),
        actions.choose<Context, any>([
          {
            cond: ctx => ctxContactNum(ctx) <= 0,
            actions: [
              actions.log(_ => 'State.reporting.entry contacts is not set', ID),
            ],
          },
          {
            cond: ctx => ctxFeedbackNum(ctx) < ctxContactNum(ctx),
            actions: [
              actions.log('State.reporting.entry feedbacks is not enough', ID),
            ],
          },
          {
            actions: [
              actions.log('State.reporting.entry feedbacks reported', ID),
              Mailbox.actions.reply(ctx => Event.FEEDBACKS(ctx.feedbacks)),
            ],
          },
        ]),
      ],
      always: State.Idle,
    },
  },
})

export {
  ID,
  Type,
  Event,
  State,
  machine,
  type Context,
  initialContext,
  ctxNextContact,
}
