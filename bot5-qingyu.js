/**
 * Wechaty - Conversational RPA SDK for Chatbot Makers.
 *  - https://github.com/wechaty/wechaty
 */
import {
  Wechaty,
  ScanStatus,
  log,
}               from 'wechaty'

import qrcodeTerminal from 'qrcode-terminal'
import 'dotenv/config.js'

function onScan (qrcode, status) {
  if (status === ScanStatus.Waiting || status === ScanStatus.Timeout) {
    qrcodeTerminal.generate(qrcode, { small: true })  // show qrcode on console

    const qrcodeImageUrl = [
      'https://wechaty.js.org/qrcode/',
      encodeURIComponent(qrcode),
    ].join('')

    log.info('StarterBot', 'onScan: %s(%s) - %s', ScanStatus[status], status, qrcodeImageUrl)

  } else {
    log.info('StarterBot', 'onScan: %s(%s)', ScanStatus[status], status)
  }
}

function onLogin (user) {
  log.info('StarterBot', '%s login', user)
}

function onLogout (user) {
  log.info('StarterBot', '%s logout', user)
}

// Ref: https://stackoverflow.com/questions/45778474/proper-request-with-async-await-in-node-js
const request = require("request");
async function getBody(path) {
  const options = {
    url: "https://api.rsvp.ai" + path,
    method: 'GET'
  }
  // Return new promise
  return new Promise(function(resolve, reject) {
    // Do async job
    request.get(options, function(err, resp, body) {
      if (err) {
        reject(err);
      } else {
        resolve(body);
      }
    })
  })
}

const countDown = new RegExp('【倒计时】([0-9]+)分钟开始！');
var timer = null;
async function onMessage (msg) {
  log.info('StarterBot', msg.toString())

  if (msg.text() === 'ding') {
    await msg.say('dong ' + inMeeting)
  }

  if (msg.self()) return;

  const room = msg.room()
  if (!room) return
  const topic = await room.topic()
  if (!topic) return
  if (!topic.startWith('BOT5')) return
  if (!await msg.room()?.topic()?.startsWith("BOT5")) return;

  if (!inMeeting && msg.text() == '开会了') {
    inMeeting = true;
  }

  if (!inMeeting) return;

  var body = await getBody(encodeURI('/sandbox/chat?botid=1006663&token=rsvpai&uid=' + msg.talker() + '&q=' + msg.text()));
  console.log(body);
  var j = JSON.parse(body);
  if (j["stage"]) {
    for (const m of j["stage"]) {
      var r = countDown.exec(m["message"]);
      if (r) {
        var minutes = parseInt(r[1]);
        timer = setTimeout(async function() {
          await msg.say("时间到！请输入“结束计时”继续。");
        }, minutes * 1000 * 60);
        console.log(timer);
      }
      if (msg.text() == "结束计时") {
        if (timer) { console.log("clear " + timer); clearTimeout(timer); console.log("after clear " + timer); };
        timer = null;
        console.log("计时器清除");
      }
      await msg.say(m["message"])
    }
  }

  if (inMeeting && msg.text() == '开完了') {
    inMeeting = false;
  }
}

var inMeeting = false;


const bot = new Wechaty({
  name: 'ding-dong-bot',
  /**
   * How to set Wechaty Puppet Provider:
   *
   *  1. Specify a `puppet` option when instantiating Wechaty. (like `{ puppet: 'wechaty-puppet-padlocal' }`, see below)
   *  1. Set the `WECHATY_PUPPET` environment variable to the puppet NPM module name. (like `wechaty-puppet-padlocal`)
   *
   * You can use the following providers:
   *  - wechaty-puppet-wechat (no token required)
   *  - wechaty-puppet-padlocal (token required)
   *  - wechaty-puppet-service (token required, see: <https://wechaty.js.org/docs/puppet-services>)
   *  - etc. see: <https://github.com/wechaty/wechaty-puppet/wiki/Directory>
   */
  // puppet: 'wechaty-puppet-wechat',
})

bot.on('scan',    onScan)
bot.on('login',   onLogin)
bot.on('logout',  onLogout)
bot.on('message', onMessage)

bot.start()
  .then(() => log.info('StarterBot', 'Starter Bot Started.'))
  .catch(e => log.error('StarterBot', e))
