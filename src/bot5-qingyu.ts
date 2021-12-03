// Ref: https://stackoverflow.com/questions/45778474/proper-request-with-async-await-in-node-js
import request from 'request'

import {
  log,
  Message,
}             from 'wechaty'

import type { Bot5AssistantContext } from './plugin.js'

async function getBody (path: string) {
  const options = {
    method: 'GET',
    url: 'https://api.rsvp.ai' + path,
  }
  // Return new promise
  return new Promise(function (resolve, reject) {
    // Do async job
    request.get(options, function (err, _resp, body) {
      if (err) {
        reject(err)
      } else {
        resolve(body)
      }
    })
  })
}

const countDown = /【倒计时】([0-9]+)分钟开始！'/
let timer: undefined | ReturnType<typeof setTimeout>

async function processMessage (
  context: Bot5AssistantContext,
  msg: Message,
) {
  log.info('StarterBot', msg.toString())

  /*
  if (context.fsm.state.matches('meeting')) {
    if (msg.text() === '开完了') {
      context.fsm.send('FINISH')
      await msg.say('收到，现在 BOT5 Assistant 结束主持会议啦，大家散会！')
    }
  } else {
    if (msg.text() === '开会了') {
      context.fsm.send('START')
      await msg.say('收到，现在 BOT5 Assistant 开始主持会议啦，请大家坐好！')
    }
  }
  */

  if (context.fsm.state.matches('idle')) return

  const body = await getBody(encodeURI('/sandbox/chat?botid=' + context.qingyu_botid + '&token=rsvpai&uid=' + msg.talker().id + '&q=' + msg.text())) as string
  console.info('### BOT5 Assistant <> RSVP.ai ###\n', body)
  const j = JSON.parse(body)
  if (!j['stage']) return
  for (const m of j['stage']) {
    context.fsm.send(m['message'])
    await msg.say(m['message'] + ' -> ' + context.fsm.state)
    break
  }

  /*
  
  配置了轻语机器人1006682（配置qingyu_botid为此值即可），用于识别意图（qingyu.rsvp.ai，用户名bot5）
  可处理的对话意图如下，相应返回message内容直接配置为控制fsm的action，便于对接
  - 开会了、会议开始等说法：START
  - 继续、下一步、继续流程等说法：NEXT
  - 开始分享、开始介绍等说法：TALK
  - 是的、对等肯定回复：YES
  - 不是、没有、不对等否定回复：NO
  - 不开了、天王盖地虎等：CANCEL
  示例：https://api.rsvp.ai/sandbox/chat?botid=1006682&token=rsvpai&uid=test&q=开会了

  */
  
    /*
    const r = countDown.exec(m['message'])
    if (r) {
      const minutes = parseInt(r[1]!)
      timer = setTimeout(function () {
        msg.say('时间到！请输入“结束计时”继续。').catch(console.error)
      }, minutes * 1000 * 60)
      console.info(timer)
    }
    if (msg.text() === '结束计时') {
      if (timer) { console.info('clear ' + timer); clearTimeout(timer); console.info('after clear ' + timer) }
      timer = undefined
      console.info('计时器清除')
    }
    await msg.say(m['message'])
    */

}

export {
  processMessage,
}
