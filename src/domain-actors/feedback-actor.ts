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

const Event = {
  ADMINS   : duck.Event.ADMINS,
  CONTACTS : duck.Event.CONTACTS,
  FEEDBACK : duck.Event.FEEDBACK,
  FEEDBACKS: duck.Event.FEEDBACKS,
  GERROR   : duck.Event.GERROR,
  IDLE     : duck.Event.IDLE,
  MESSAGE  : duck.Event.MESSAGE,
  PROCESS  : duck.Event.PROCESS,
  REPORT   : duck.Event.REPORT,
  RESET    : duck.Event.RESET,
} as const

type Event = {
  [key in keyof typeof Event]: ReturnType<typeof Event[key]>
}

const State = {
  feedbacking  : duck.State.feedbacking,
  Idle         : duck.State.Idle,
  initializing : duck.State.initializing,
  parsing      : duck.State.parsing,
  processing   : duck.State.processing,
  registering  : duck.State.registering,
  reporting    : duck.State.reporting,
} as const

type State = typeof State[keyof typeof State]

type Context = {
  admins    : { [id: string]: PUPPET.payloads.Contact }
  contacts  : { [id: string]: PUPPET.payloads.Contact }
  message?  : PUPPET.payloads.Message,
  feedbacks : { [id: string]: string }
  address?: {
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

function initialContext (): Context {
  const context: Context = {
    address   : undefined,
    admins    : {},
    contacts  : {},
    message   : undefined,
    feedbacks : {},
  }
  return JSON.parse(JSON.stringify(context))
}

const ID = 'FeedbackMachine'

const machine = createMachine<Context, Event[keyof Event]>({
  id: ID,
  context: initialContext(),
  /**
   * Issue statelyai/xstate#2891:
   *  The context provided to the expr inside a State
   *  should be exactly the **context in this state**
   * @see https://github.com/statelyai/xstate/issues/2891
   */
  preserveActionOrder: true,
  initial: State.initializing,
  states: {
    [State.initializing]: {
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
        [Type.CONTACTS]: {
          actions: [
            actions.assign({
              contacts: (_, e) => e.payload.contacts.reduce((acc, cur) => ({
                ...acc,
                [cur.id]: cur,
              }), {}),
            }),
          ],
        },
        [Type.REPORT]: {
          actions: [
            actions.log('State.idle.on.REPORT', ID),
          ],
          target: State.processing,
        },
        [Type.RESET]: {
          actions: [
            actions.log('State.idle.on.RESET', ID),
            actions.assign(ctx => ({
              ...ctx,
              ...initialContext(),
            })),
          ],
          target: State.initializing,
        },
        [Type.MESSAGE]: {
          actions: [
            actions.log('State.idle.on.MESSAGE', ID),
            actions.assign({
              message: (_, e) => e.payload.message,
            }),
          ],
          target: State.parsing,
        },
      },
    },
    [State.parsing]: {
      entry: [
        actions.log('State.parsing.entry', ID),
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
          target: State.feedbacking,
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
    [State.feedbacking]: {
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
        [Type.PROCESS]:  State.processing,
        [Type.IDLE]:     State.Idle,
      },
    },
    [State.registering]: {
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
          target: State.processing,
        },
      },
    },
    [State.processing]: {
      entry: actions.log('State.processing.entry', ID),
      always: [
        {
          cond: ctx => ctxContactNum(ctx) <= 0,
          actions:[
            actions.log('State.processing.always -> registering because no contacts', ID),
          ],
          target: State.registering,
        },
        {
          target: State.reporting,
          actions: actions.log('State.processing.always -> reporting', ID),
        },
      ],
    },
    [State.reporting]: {
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
