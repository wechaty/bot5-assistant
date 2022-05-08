import type * as PUPPET from 'wechaty-puppet'

export const mentionIdList = (message: PUPPET.payloads.Message) => 'mentionIdList' in message ? (message.mentionIdList ?? []) : []
