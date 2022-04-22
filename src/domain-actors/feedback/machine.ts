/* eslint-disable no-redeclare */
/* eslint-disable sort-keys */
import { actions, createMachine }   from 'xstate'
import { GError }                   from 'gerror'
import * as Mailbox                 from 'mailbox'

import { messageToText }    from '../../application-actors/mod.js'

import * as noticing    from '../noticing/mod.js'

import duckula, { Context }   from './duckula.js'

const ctxContactNum   = (ctx: Context) => Object.keys(ctx.contacts).length
const ctxFeedbackNum  = (ctx: Context) => Object.values(ctx.feedbacks).filter(Boolean).length
const ctxNextContact  = (ctx: Context) => Object.values(ctx.contacts).filter(c =>
  !Object.keys(ctx.feedbacks).includes(c.id),
)[0]
const ctxContactAfterNext   = (ctx: Context) => Object.values(ctx.contacts).filter(c =>
  !Object.keys(ctx.feedbacks).includes(c.id),
)[1]

const machine = createMachine<
  Context,
  ReturnType<typeof duckula.Event[keyof typeof duckula.Event]>
>({
  id: duckula.id,
  /**
   * Issue statelyai/xstate#2891:
   *  The context provided to the expr inside a State
   *  should be exactly the **context in this state**
   * @see https://github.com/statelyai/xstate/issues/2891
   */
  preserveActionOrder: true,
  context: duckula.initialContext,
  initial: duckula.State.Initializing,
  states: {
    [duckula.State.Initializing]: {
      always: duckula.State.Idle,
    },

    /**
     *
     * 1. received CONTACTS -> save to context.contacts
     *
     * 2. received MESSAGE  -> transition to Parsing
     * 3. received RESET    -> transition to Initializing
     * 4. received REPORT   -> transition to Reporting
     *
     */
    [duckula.State.Idle]: {
      entry: [
        Mailbox.actions.idle(duckula.id)('idle'),
        actions.assign({
          message: undefined,
        }),
      ],
      on: {
        /**
         * Huan(202112):
         *  Every EVENTs received in state.idle must have a `target` to make sure it is a `external` event.
         *  so that the Mailbox.actions.idle() will be triggered and let the Mailbox knowns it's ready to process next message.
         */
        '*': duckula.State.Idle,
        [duckula.Type.MESSAGE]: {
          actions: [
            actions.log('state.Idle.on.MESSAGE', duckula.id),
            actions.assign({ message: (_, e) => e.payload.message }),
          ],
          target: duckula.State.Textualizing,
        },

        [duckula.Type.RESET]: {
          actions: [
            actions.log('state.Idle.on.RESET', duckula.id),
            actions.assign(ctx => ({
              ...ctx,
              ...duckula.initialContext(),
            })),
          ],
          target: duckula.State.Initializing,
        },

        [duckula.Type.CONTACTS]: {
          actions: [
            actions.assign({
              contacts: (_, e) => e.payload.contacts.reduce((acc, cur) => ({
                ...acc,
                [cur.id]: cur,
              }), {}),
            }),
          ],
          target: duckula.State.Idle,
        },

        [duckula.Type.REPORT]: {
          actions: [
            actions.log('state.Idle.on.REPORT', duckula.id),
          ],
          target: duckula.State.Processing,
        },
      },
    },

    /**
     * 1. received MESSAGE  -> TEXT / GERROR
     * 2. received TEXT     -> FEEDBACK
     *
     * 3. received FEEDBACK -> transition to Feedbacking
     * 4. received GERROR   -> transition to Erroring
     */
    [duckula.State.Textualizing]: {
      invoke: {
        id: messageToText.id,
        src: ctx => messageToText.machine.withContext({
          ...messageToText.initialContext(),
          address: ctx.address,
        }),
        onDone:   { actions: actions.send((_, e) => duckula.Event.GERROR(GError.stringify(e.data))) },
        onError:  { actions: actions.send((_, e) => duckula.Event.GERROR(GError.stringify(e.data))) },
      },
      entry: [
        actions.log('state.Textualizing.entry', duckula.id),
        actions.send((_, e) => e, { to: messageToText.id }),
      ],
      on: {
        [duckula.Type.ACTOR_REPLY]: {
          actions: [
            actions.log((_, e) => `state.Textualizing.on.ACTOR_REPLY [${e.payload.message.type}]`, duckula.id),
            actions.send((_, e) => e.payload.message),
          ],
        },
        [duckula.Type.TEXT]: {
          actions: [
            actions.log((_, e) => `state.Textualizing.on.TEXT [${e.payload.text}]`, duckula.id),
            actions.send((ctx, e) => duckula.Event.FEEDBACK(
              ctx.message!.talkerId,
              e.payload.text,
            )),
          ],
        },
        [duckula.Type.FEEDBACK] : duckula.State.Feedbacking,
        [duckula.Type.GERROR]   : duckula.State.Erroring,
      },
    },

    [duckula.State.Feedbacking]: {
      entry: [
        actions.log<Context, ReturnType<typeof duckula.Event.FEEDBACK>>((_, e) => `states.Feedbacking.entry ${e.payload.contactId}: "${e.payload.feedback}"`, duckula.id),
        actions.assign<Context, ReturnType<typeof duckula.Event.FEEDBACK>>({
          feedbacks: (ctx, e) => ({
            ...ctx.feedbacks,
            [e.payload.contactId]: e.payload.feedback,
          }),
        }),
        actions.send<Context, ReturnType<typeof duckula.Event.FEEDBACK>>(
          (ctx, e) => noticing.Event.NOTICE(
            [
              '【反馈系统】',
              `收到${ctx.contacts[e.payload.contactId]!.name}的反馈：`,
              `“${e.payload.feedback}”`,
            ].join(''),
          ),
          { to: ctx => ctx.address.noticing },
        ),
      ],
      always: duckula.State.Nexting,
    },

    [duckula.State.Nexting]: {
      entry: [
        actions.choose<Context, any>([
          {
            cond: ctx => !!ctxNextContact(ctx),
            actions: [
              actions.send(ctx => noticing.Event.NOTICE(
                [
                  '【反馈系统】',
                  `下一位：@${ctxNextContact(ctx)?.name}`,
                  ctxContactAfterNext(ctx)?.name ? `。（请@${ctxContactAfterNext(ctx)?.name}做准备）` : '',
                ].join(''),
                ctxContactAfterNext(ctx)
                  ? [ ctxNextContact(ctx)!.id, ctxContactAfterNext(ctx)!.id ]
                  : [ ctxNextContact(ctx)!.id ],
              )),
            ],
          },
          {
            actions: [
              actions.send(ctx => noticing.Event.NOTICE([
                '【反馈系统】：已完成收集所有人反馈：',
                Object.values(ctx.contacts).map(contact => contact.name).join('，'),
                `共 ${Object.keys(ctx.contacts).length} 人。`,
              ].join(''))),
            ],
          },
        ]),
        actions.send(duckula.Event.NEXT()),
      ],
      on: {
        [duckula.Type.NEXT]:  duckula.State.Processing,
      },
    },

    [duckula.State.Registering]: {
      entry: [
        actions.log('state.registering.entry', duckula.id),
        actions.send(duckula.Event.REPORT, { to: ctx => ctx.address.registering }),
      ],
      on: {
        [duckula.Type.MESSAGE]: {
          actions: [
            actions.send((_, e) => e, { to: ctx => ctx.address.registering }),
          ],
        },
        [duckula.Type.CONTACTS]: {
          actions: [
            actions.assign({
              contacts: (_, e) => e.payload.contacts.reduce((acc, cur) => ({
                ...acc,
                [cur.id]: cur,
              }), {}),
            }),
            actions.send(duckula.Event.NEXT()),
          ],
        },
        [duckula.Type.NEXT]: duckula.State.Processing,
      },
    },

    [duckula.State.Processing]: {
      entry: actions.log('state.processing.entry', duckula.id),
      always: [
        {
          cond: ctx => ctxContactNum(ctx) <= 0,
          actions:[
            actions.log('state.processing.always -> registering because no contacts', duckula.id),
          ],
          target: duckula.State.Registering,
        },
        {
          target: duckula.State.Reporting,
          actions: actions.log('state.processing.always -> reporting', duckula.id),
        },
      ],
    },

    [duckula.State.Reporting]: {
      entry: [
        actions.log(ctx => `state.reporting.entry feedbacks/contacts(${ctxFeedbackNum(ctx)}/${ctxContactNum(ctx)})`, duckula.id),
        actions.choose<Context, any>([
          {
            cond: ctx => ctxContactNum(ctx) <= 0,
            actions: [
              actions.log(_ => 'state.reporting.entry contacts is not set', duckula.id),
            ],
          },
          {
            cond: ctx => ctxFeedbackNum(ctx) < ctxContactNum(ctx),
            actions: [
              actions.log('state.reporting.entry feedbacks is not enough', duckula.id),
            ],
          },
          {
            actions: [
              actions.log('state.reporting.entry feedbacks reported', duckula.id),
              Mailbox.actions.reply(ctx => duckula.Event.FEEDBACKS(ctx.feedbacks)),
            ],
          },
        ]),
      ],
      always: duckula.State.Idle,
    },

    [duckula.State.Erroring]: {
      entry: [
        actions.log<Context, ReturnType<typeof duckula.Event.GERROR>>((_, e) => `state.Erroring.entry [GERROR("${e.payload.gerror}")]`, duckula.id),
        actions.send((_, e) => e),
      ],
      on: {
        [duckula.Type.GERROR]: duckula.State.Responding,
      },
    },

    [duckula.State.Responding]: {
      entry: [
        actions.log((_, e) => `state.Responding.entry [${e.type}]`, duckula.id),
        Mailbox.actions.reply((_, e) => e),
      ],
    },
  },
})

export default machine
