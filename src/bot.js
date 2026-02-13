/**
 * 微信机器人模块
 * 使用 Wechaty 框架接入个人微信
 */
const { WechatyBuilder, ScanStatus, log } = require('wechaty');

console.log('[微信机器人] Wechaty模块加载成功');

const QRCode = require('qrcode');
const config = require('./config');
const { fetchAllNews, formatNewsMessage } = require('./news');

let bot = null;
let isBotReady = false;

/**
 * 生成登录二维码
 */
async function generateQRCode(qrcodedata) {
  try {
    const qrcodeUrl = await QRCode.toDataURL(qrcodedata);
    console.log('[微信机器人] 登录二维码已生成');
    return qrcodeUrl;
  } catch (error) {
    console.error('[微信机器人] 生成二维码失败:', error);
    return null;
  }
}

/**
 * 初始化微信机器人
 */
async function initBot() {
  console.log('[微信机器人] 初始化中...');

  // 创建机器人实例
  const botConfig = {
    name: 'telecom-bot',
  };
  
  // 只有配置了puppet时才添加
  if (config.wechaty.puppet) {
    botConfig.puppet = config.wechaty.puppet;
  }

  bot = WechatyBuilder.build(botConfig);

  // 机器人事件处理
  bot
    .on('scan', async (qrcode, status) => {
      if (status === ScanStatus.Waiting || status === ScanStatus.Timeout) {
        // 直接显示二维码URL
        console.log('\n');
        console.log('═══════════════════════════════════════');
        console.log('   请用手机微信扫描以下二维码登录   ');
        console.log('═══════════════════════════════════════');
        console.log('\n二维码链接:');
        console.log(qrcode);
        console.log('\n或者访问: https://wechaty.js.org/qrcode/' + qrcode);
        console.log('\n═══════════════════════════════════════\n');

        // 如果配置了管理员，发送二维码给管理员
        if (isBotReady && config.admin.wechatId) {
          try {
            const contact = await bot.Contact.find({ id: config.admin.wechatId });
            if (contact) {
              await contact.say('📱 请扫描下方二维码登录机器人：\n\n如果二维码无法显示，请手动登录微信后台查看');
            }
          } catch (e) {
            console.error('[微信机器人] 发送二维码失败:', e.message);
          }
        }
      } else if (status === ScanStatus.Scanned) {
        console.log('[微信机器人] 已扫描二维码，请确认登录');
      } else if (status === ScanStatus.Confirmed) {
        console.log('[微信机器人] 已确认登录');
      }
    })
    .on('login', async (user) => {
      console.log(`[微信机器人] 登录成功: ${user.name()}`);
      isBotReady = true;

      // 发送登录成功通知
      if (config.admin.wechatId) {
        try {
          const contact = await bot.Contact.find({ id: config.admin.wechatId });
          if (contact) {
            await contact.say('✅ 电信资讯机器人已启动！\n\n每天9点将为您推送电信行业最新资讯。');
          }
        } catch (e)
          console.error('[微信机器人] 发送欢迎消息失败:', e.message);
      }
    })
    .on('logout', (user, reason) => {
      console.log(`[微信机器人] 已退出登录: ${user.name()}, 原因: ${reason}`);
      isBotReady = false;
    })
    .on('error', (error) => {
      console.error('[微信机器人] 错误:', error);
    })
    .on('message', async (message) => {
      // 处理接收到的消息
      await handleMessage(message);
    });

  return bot;
}

/**
 * 处理接收到的消息
 */
async function handleMessage(message) {
  try {
    const contact = message.talker();
    const text = message.text().trim();
    const room = message.room();
    const type = message.type();

    // 忽略群消息
    if (room) {
      return;
    }

    // 忽略语音、图片等非文本消息
    if (type !== bot.Message.Type.Text) {
      return;
    }

    const contactName = contact.name() || '未知用户';
    const contactId = contact.id;

    console.log(`[消息] 收到 ${contactName}(${contactId}) 的消息: ${text}`);

    // 命令处理
    const command = text.toLowerCase();

    if (command === '帮助' || command === 'help' || command === '?') {
      await contact.say(getHelpMessage());
      return;
    }

    if (command === '新闻' || command === '资讯' || command === '最新') {
      await contact.say('📥 正在获取最新资讯，请稍候...');
      const news = await fetchAllNews();
      const message = formatNewsMessage(news);
      await contact.say(message);
      return;
    }

    if (command === '测试' || command === 'test') {
      await contact.say('🤖 机器人运行正常！\n\n输入"帮助"查看更多命令。');
      return;
    }

    // 自动回复配置
    const autoReply = getAutoReply(text);
    if (autoReply) {
      await contact.say(autoReply);
    }
  } catch (error) {
    console.error('[消息处理] 错误:', error);
  }
}

/**
 * 获取帮助信息
 */
function getHelpMessage() {
  return `📖 电信资讯机器人使用帮助

【命令列表】
• 新闻 / 资讯 / 最新 - 立即获取当日资讯
• 测试 - 测试机器人是否正常运行
• 帮助 - 显示本帮助信息

【自动回复关键词】
• 工信部 - 了解工信部最新动态
• 联通 - 中国联通相关资讯
• 反诈 - 反诈防骗提示
• 5G - 5G相关资讯

【推送说明】
每天 ${config.pushTime.hour}:${String(config.pushTime.minute).padStart(2, '0')} 自动推送 ${config.newsCount} 条电信行业资讯

【联系我们】
如有建议或问题，欢迎随时联系`;
}

/**
 * 自动回复关键词匹配
 */
function getAutoReply(text) {
  const keywords = {
    '工信部': '📡 工信部负责工业和信息化发展，统筹推进数字中国建设，监管重点包括电信、互联网、5G发展等。',
    '联通': '📱 中国联通提供移动通信、固网宽带、云计算等基础通信服务。',
    '反诈': '🛡️ 国家反诈中心提示：警惕冒充公检法、虚假投资、刷单返利等诈骗手段。如遇诈骗请拨打96110。',
    '5g': '📶 5G是第五代移动通信技术，提供更快的速度和更低的延迟，推动物联网、智能制造等发展。',
    '运营商': '📡 中国电信运营商包括中国移动、中国联通、中国电信、中国广电。',
    '诈骗': '🛡️ 防范诈骗：不听、不信、不转账！不点击陌生链接，不向陌生人转账。',
  };

  for (const [key, reply] of Object.entries(keywords)) {
    if (text.includes(key)) {
      return reply;
    }
  }

  return null;
}

/**
 * 发送消息给指定用户
 */
async function sendMessageToUser(wechatId, message) {
  if (!bot || !isBotReady) {
    console.error('[发送消息] 机器人未就绪');
    return false;
  }

  try {
    const contact = await bot.Contact.find({ id: wechatId });
    if (contact) {
      await contact.say(message);
      console.log(`[发送消息] 成功发送给 ${wechatId}`);
      return true;
    } else {
      console.error(`[发送消息] 未找到用户 ${wechatId}`);
      return false;
    }
  } catch (error) {
    console.error('[发送消息] 失败:', error.message);
    return false;
  }
}

/**
 * 群发消息给所有目标用户
 */
async function broadcastMessage(message) {
  if (!isBotReady) {
    console.error('[群发消息] 机器人未就绪');
    return { success: 0, failed: 0 };
  }

  const results = { success: 0, failed: 0 };

  // 发送给配置的所有目标用户
  for (const wechatId of config.targetUsers) {
    const success = await sendMessageToUser(wechatId, message);
    if (success) {
      results.success++;
    } else {
      results.failed++;
    }
    // 避免发送过快
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return results;
}

/**
 * 启动机器人
 */
async function startBot() {
  try {
    await initBot();
    await bot.start();
    console.log('[微信机器人] 已启动');
    return bot;
  } catch (error) {
    console.error('[微信机器人] 启动失败:', error);
    throw error;
  }
}

/**
 * 停止机器人
 */
async function stopBot() {
  if (bot) {
    await bot.stop();
    console.log('[微信机器人] 已停止');
  }
}

/**
 * 检查机器人是否就绪
 */
function isReady() {
  return isBotReady;
}

module.exports = {
  startBot,
  stopBot,
  sendMessageToUser,
  broadcastMessage,
  isReady,
  fetchAllNews,
  formatNewsMessage,
};