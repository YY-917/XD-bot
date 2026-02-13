/**
 * 电信行业资讯推送机器人主入口
 * 功能：定时获取并推送电信行业新闻
 */
const schedule = require('node-schedule');
const moment = require('moment');
const config = require('./config');
const { fetchAllNews, formatNewsMessage } = require('./news');
const { startBot, stopBot, broadcastMessage, isReady } = require('./bot');

// 全局状态
let isScheduled = false;
let lastPushTime = null;

/**
 * 执行每日新闻推送
 */
async function performDailyPush() {
  console.log(`[定时任务] 开始执行每日推送 (${moment().format('YYYY-MM-DD HH:mm:ss')})`);

  // 检查机器人是否就绪
  if (!isReady()) {
    console.error('[定时任务] 机器人未就绪，跳过推送');
    return;
  }

  try {
    // 获取新闻
    console.log('[定时任务] 正在获取新闻资讯...');
    const news = await fetchAllNews();

    if (!news || news.length === 0) {
      console.log('[定时任务] 未获取到新闻，跳过推送');
      return;
    }

    // 格式化消息
    const message = formatNewsMessage(news);

    // 发送消息
    console.log('[定时任务] 正在推送消息...');
    const results = await broadcastMessage(message);

    console.log(`[定时任务] 推送完成: 成功 ${results.success}, 失败 ${results.failed}`);
    lastPushTime = moment().format('YYYY-MM-DD HH:mm:ss');

    // 打印推送的详细内容
    console.log('[定时任务] 推送内容预览:');
    news.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.title.substring(0, 50)}...`);
    });

  } catch (error) {
    console.error('[定时任务] 推送失败:', error);
  }
}

/**
 * 设置定时推送任务
 */
function setupScheduledPush() {
  if (isScheduled) {
    console.log('[定时任务] 任务已设置');
    return;
  }


  const { hour, minute } = config.pushTime;

  // 每天指定时间执行
  const rule = new schedule.RecurrenceRule();
  rule.hour = hour;
  rule.minute = minute;

  const job = schedule.scheduleJob(rule, async () => {
    await performDailyPush();
  });

  isScheduled = true;
  console.log(`[定时任务] 已设置: 每天 ${hour}:${String(minute).padStart(2, '0')}`);

  // 立即执行一次测试（可选）
  // setTimeout(() => performDailyPush(), 5000);
}

/**
 * 设置手动触发命令
 */
function setupManualCommands(bot) {
  // 这个功能已经在 bot.js 的 message 事件中处理
  console.log('[命令设置] 手动命令已就绪');
}

/**
 * 优雅退出处理
 */
function setupGracefulShutdown() {
  const shutdown = async (signal) => {
    console.log(`\n[系统] 收到 ${signal} 信号，开始关闭...`);

    // 停止定时任务
    schedule.cancelAll();
    console.log('[系统] 定时任务已取消');

    // 停止机器人
    await stopBot();
    console.log('[系统] 微信机器人已停止');

    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

/**
 * 打印启动信息
 */
function printStartupInfo() {
  console.log('\n========================================');
  console.log('   电信行业资讯推送机器人');
  console.log('========================================\n');

  console.log('📋 配置信息:');
  console.log(`   • 推送时间: ${config.pushTime.hour}:${String(config.pushTime.minute).padStart(2, '0')}`);
  console.log(`   • 推送条数: ${config.newsCount} 条/天`);
  console.log(`   • 目标用户: ${config.targetUsers.length} 人`);
  console.log(`   • 新闻源: ${Object.entries(config.newsSources).filter(([_, v]) => v).length} 个`);

  console.log('\n📖 命令说明:');
  console.log('   • 新闻 / 资讯 - 立即获取当日资讯');
  console.log('   • 测试 - 测试机器人');
  console.log('   • 帮助 - 查看帮助信息');

  console.log('\n⏰ 等待微信登录...\n');
}

/**
 * 主函数
 */
async function main() {
  try {
    // 打印启动信息
    printStartupInfo();

    // 设置优雅退出
    setupGracefulShutdown();

    // 启动微信机器人
    await startBot();

    // 设置定时推送任务
    setupScheduledPush();

    console.log('[系统] 机器人启动完成');

  } catch (error) {
    console.error('[系统] 启动失败:', error);
    process.exit(1);
  }
}

// 启动程序
main();