/**
 * 配置文件加载模块
 */
require('dotenv').config();

module.exports = {
  // 微信机器人配置（不指定puppet，使用Wechaty默认）
  wechaty: {
    puppet: process.env.WECHATY_PUPPET || undefined,
  },

  // 推送目标配置
  admin: {
    wechatId: process.env.ADMIN_WECHAT_ID || '',
  },
  targetUsers: (process.env.TARGET_USERS || '').split(',').filter(u => u.trim()),

  // 新闻源开关
  newsSources: {
    miit: process.env.ENABLE_MIIT !== 'false',
    unicom: process.env.ENABLE_UNICOM !== 'false',
    antiFraud: process.env.ENABLE_ANTI_FRAUD !== 'false',
  },

  // 推送时间配置
  pushTime: {
    hour: parseInt(process.env.PUSH_HOUR || '9'),
    minute: parseInt(process.env.PUSH_MINUTE || '0'),
  },

  // 每日推送条数
  newsCount: parseInt(process.env.NEWS_COUNT || '5'),

  // 日志级别
  logLevel: process.env.LOG_LEVEL || 'info',
};