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
/* eslint-disable no-redeclare */
/* eslint-disable sort-keys */
import { actions, AnyEventObject, createMachine }     from 'xstate'
import { GError }                                     from 'gerror'
import * as Mailbox                                   from 'mailbox'

import { MessageToText }    from '../../application-actors/mod.js'
import { responseStates }   from '../../actor-utils/mod.js'

import * as Notice    from '../notice/mod.js'

import duckula, { Context, Event, Events }    from './duckula.js'
import * as selectors                         from './selectors.js'

const machine = createMachine<Context, Event>({
  id: duckula.id,
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
        Mailbox.actions.idle(duckula.id),
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
            actions.log('states.Idle.on.MESSAGE', duckula.id),
            actions.assign({ message: (_, e) => e.payload.message }),
          ],
          target: duckula.State.Textualizing,
        },

        [duckula.Type.RESET]: {
          actions: [
            actions.log('states.Idle.on.RESET', duckula.id),
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
            actions.log('states.Idle.on.REPORT', duckula.id),
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
     * 4. received GERROR   -> transition to Errored
     */
    [duckula.State.Textualizing]: {
      invoke: {
        id: MessageToText.id,
        src: ctx => MessageToText.machine.withContext({
          ...MessageToText.initialContext(),
          actors: {
            wechaty: ctx.actors.wechaty,
          },
        }),
        onDone:   { actions: actions.send((_, e) => duckula.Event.GERROR(GError.stringify(e.data))) },
        onError:  { actions: actions.send((_, e) => duckula.Event.GERROR(GError.stringify(e.data))) },
      },
      entry: [
        actions.log('states.Textualizing.entry', duckula.id),
        actions.send((_, e) => e, { to: MessageToText.id }),
      ],
      on: {
        [duckula.Type.ACTOR_REPLY]: {
          actions: [
            actions.log((_, e) => `states.Textualizing.on.ACTOR_REPLY [${e.payload.message.type}]`, duckula.id),
            actions.send((_, e) => e.payload.message),
          ],
        },
        [duckula.Type.TEXT]   : duckula.State.Feedbacking,
        [duckula.Type.GERROR] : duckula.State.Errored,
      },
    },

    [duckula.State.Feedbacking]: {
      entry: [
        actions.log<Context, Events['TEXT']>((_, e) => `states.Feedbacking.entry ${e.payload.message?.talkerId}: "${e.payload.text}"`, duckula.id),
        actions.assign<Context, Events['TEXT']>({
          feedbacks: (ctx, e) => ({
            ...ctx.feedbacks,
            ...e.payload.message && { [e.payload.message.talkerId]: e.payload.text },
          }),
        }),
        actions.send<Context, Events['TEXT']>(
          (ctx, e) => Notice.Event.NOTICE(
            [
              '【反馈系统】',
              `收到${(e.payload.message && ctx.contacts[e.payload.message.talkerId])?.name}的反馈：`,
              `“${e.payload.text}”`,
            ].join(''),
          ),
          { to: ctx => ctx.actors.noticing },
        ),
        actions.send(duckula.Event.NEXT()),
      ],
      on: {
        [duckula.Type.NEXT]: duckula.State.Nexting,
      },
    },

    [duckula.State.Nexting]: {
      entry: [
        actions.choose<Context, any>([
          {
            cond: ctx => !!selectors.nextContact(ctx),
            actions: [
              actions.send(ctx => Notice.Event.NOTICE(
                [
                  '【反馈系统】',
                  `下一位：@${selectors.nextContact(ctx)?.name}`,
                  selectors.contactAfterNext(ctx)?.name ? `。（请@${selectors.contactAfterNext(ctx)?.name}做准备）` : '',
                ].join(''),
                selectors.contactAfterNext(ctx)
                  ? [ selectors.nextContact(ctx)!.id, selectors.contactAfterNext(ctx)!.id ]
                  : [ selectors.nextContact(ctx)!.id ],
              )),
            ],
          },
          {
            actions: [
              actions.send(ctx => Notice.Event.NOTICE([
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
        actions.log('states.Registering.entry', duckula.id),
        actions.send(
          duckula.Event.REPORT(),
          { to: ctx => ctx.actors.register },
        ),
      ],
      on: {
        /**
         * Forward the REPORT event to the registering machine.
         */
        [duckula.Type.MESSAGE]: {
          actions: [
            actions.send(
              (_, e) => e,
              { to: ctx => ctx.actors.register },
            ),
          ],
        },
        /**
         * Accept the CONTACTS (in response to REPORT) event from the registering machine.
         */
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
        /**
         * All done. Continue.
         */
        [duckula.Type.NEXT]: duckula.State.Processing,
      },
    },

    [duckula.State.Processing]: {
      entry: [
        actions.log('states.processing.entry', duckula.id),
        actions.choose<Context, AnyEventObject>([
          {
            cond: ctx => selectors.contactNum(ctx) <= 0,
            actions:[
              actions.log('states.processing.entry no contacts', duckula.id),
              actions.send(duckula.Event.NO_CONTACT()),
            ],
          },
          {
            actions: [
              actions.log('states.processing.entry transition to NEXT', duckula.id),
              actions.send(duckula.Event.NEXT()),
            ],
          },
        ]),
      ],
      on: {
        [duckula.Type.NO_CONTACT] : duckula.State.Registering,
        [duckula.Type.NEXT]       : duckula.State.Reporting,
      },
    },

    [duckula.State.Reporting]: {
      entry: [
        actions.log(ctx => `states.Reporting.entry feedbacks/contacts(${selectors.feedbackNum(ctx)}/${selectors.contactNum(ctx)})`, duckula.id),
        actions.choose<Context, any>([
          {
            cond: ctx => selectors.contactNum(ctx) <= 0,
            actions: [
              actions.log(_ => 'state.reporting.entry contacts is not set', duckula.id),
            ],
          },
          {
            cond: ctx => selectors.feedbackNum(ctx) < selectors.contactNum(ctx),
            actions: [
              actions.log('states.Reporting.entry feedbacks is not enough', duckula.id),
            ],
          },
          {
            actions: [
              actions.log('states.Reporting.entry replying [FEEDBACKS]', duckula.id),
              Mailbox.actions.reply(ctx => duckula.Event.FEEDBACKS(ctx.feedbacks)),
            ],
          },
        ]),
        actions.send(duckula.Event.NEXT()),
      ],
      on: {
        [duckula.Type.NEXT]: duckula.State.Idle,
      },
    },

    ...responseStates(duckula.id),
  },
})

export default machine
