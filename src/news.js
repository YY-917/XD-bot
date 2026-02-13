/**
 * 新闻资讯爬取模块
 * 支持：工信部、联通、反诈等电信行业新闻
 */
const axios = require('axios');
const cheerio = require('cheerio');
const moment = require('moment');
const config = require('./config');

// 中文时间格式化
moment.locale('zh-cn');

/**
 * 新闻源配置
 */
const NEWS_SOURCES = {
  // 工信部
  miit: {
    name: '工信部',
    urls: [
      'https://www.miit.gov.cn/gxsj/tjfx/txy/index.html',
      'https://www.miit.gov.cn/gxsj/tjfx/txy/index_1.html',
    ],
    baseUrl: 'https://www.miit.gov.cn',
  },
  // 中国联通
  unicom: {
    name: '中国联通',
    urls: [
      'https://www.10010.com/news/',
      'https://www.10010.com/news/page/1/',
    ],
    baseUrl: 'https://www.10010.com',
  },
  // 反诈中心
  antiFraud: {
    name: '国家反诈中心',
    urls: [
      'https://www.12381.cn/',
      'https://www.12381.cn/news/',
    ],
    baseUrl: 'https://www.12381.cn',
  },
  // 备选新闻源
  backup: {
    name: '通信世界网',
    urls: [
      'http://www.cww.net.cn/news/list/22',
    ],
    baseUrl: 'http://www.cww.net.cn',
  },
};

/**
 * 通用爬取函数
 */
async function fetchNews(url, sourceConfig, selector = 'div.news_list li, ul.news-list li, div.article-list li') {
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
    });

    const $ = cheerio.load(response.data);
    const articles = [];

    $(selector).each((index, element) => {
      if (articles.length >= 10) return;

      const $el = $(element);
      let title = '';
      let link = '';
      let date = '';
      let source = sourceConfig.name;

      // 尝试多种选择器
      const titleEl = $el.find('a').first() || $el;
      title = titleEl.text().trim() || $el.find('a').text().trim();
      link = titleEl.attr('href') || $el.find('a').attr('href');

      // 处理相对链接
      if (link && !link.startsWith('http')) {
        link = sourceConfig.baseUrl + (link.startsWith('/') ? '' : '/') + link;
      }

      // 提取日期
      const dateEl = $el.find('span.date, .time, .date-text, span');
      date = dateEl.text().trim() || moment().format('YYYY-MM-DD');

      // 过滤有效文章
      if (title && title.length > 5 && !title.includes('更多')) {
        articles.push({
          title: title.substring(0, 100),
          link: link || '',
          date: date,
          source: source,
        });
      }
    });

    return articles;
  } catch (error) {
    console.error(`[新闻爬取] ${sourceConfig.name} - ${url} 失败:`, error.message);
    return [];
  }
}

/**
 * 从工信部获取新闻
 */
async function fetchMiitNews() {
  const articles = [];
  const source = NEWS_SOURCES.miit;

  for (const url of source.urls) {
    const news = await fetchNews(url, source, 'div.news_list ul li, div.tcyw_list ul li, div.con li, .clist li');
    articles.push(...news);
    if (articles.length >= 5) break;
  }

  return articles;
}

/**
 * 从中国联通获取新闻
 */
async function fetchUnicomNews() {
  const articles = [];
  const source = NEWS_SOURCES.unicom;

  for (const url of source.urls) {
    const news = await fetchNews(url, source, 'div.news-list li, ul.news-list li, .news-item, .news-list-item');
    articles.push(...news);
    if (articles.length >= 5) break;
  }

  return articles;
}

/**
 * 从反诈中心获取新闻
 */
async function fetchAntiFraudNews() {
  const articles = [];
  const source = NEWS_SOURCES.antiFraud;

  try {
    const response = await axios.get(source.urls[0], {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    const $ = cheerio.load(response.data);
    const newsItems = [];

    // 反诈中心特殊选择器
    $('.news-item, .article-item, .list-item, .news-list-item').each((index, element) => {
      if (newsItems.length >= 10) return;

      const $el = $(element);
      const titleEl = $el.find('a').first();
      const title = titleEl.text().trim();
      let link = titleEl.attr('href');

      if (link && !link.startsWith('http')) {
        link = source.baseUrl + link;
      }

      if (title && title.length > 5) {
        newsItems.push({
          title: title.substring(0, 100),
          link: link || '',
          date: moment().format('YYYY-MM-DD'),
          source: source.name,
        });
      }
    });

    articles.push(...newsItems);
  } catch (error) {
    console.error('[新闻爬取] 反诈中心失败:', error.message);
  }

  return articles;
}

/**
 * 从备选源获取新闻
 */
async function fetchBackupNews() {
  const articles = [];
  const source = NEWS_SOURCES.backup;

  for (const url of source.urls) {
    const news = await fetchNews(url, source, 'div.news_list ul li, ul.news-list li, .item, .article-item');
    articles.push(...news);
    if (articles.length >= 10) break;
  }

  return articles;
}

/**
 * 获取所有新闻
 */
async function fetchAllNews() {
  console.log('[新闻爬取] 开始获取电信行业资讯...');

  const allNews = [];
  const tasks = [];

  // 根据配置决定启用哪些源
  if (config.newsSources.miit) {
    tasks.push(fetchMiitNews());
  }

  if (config.newsSources.unicom) {
    tasks.push(fetchUnicomNews());
  }

  if (config.newsSources.antiFraud) {
    tasks.push(fetchAntiFraudNews());
  }

  // 始终添加备选源
  tasks.push(fetchBackupNews());

  const results = await Promise.allSettled(tasks);

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      allNews.push(...result.value);
    }
  }

  // 去重并按日期排序
  const uniqueNews = [];
  const seen = new Set();

  for (const news of allNews) {
    const key = news.title.substring(0, 30);
    if (!seen.has(key)) {
      seen.add(key);
      uniqueNews.push(news);
    }
  }

  // 限制数量
  const limitedNews = uniqueNews.slice(0, config.newsCount);

  console.log(`[新闻爬取] 获取到 ${limitedNews.length} 条新闻`);

  return limitedNews;
}

/**
 * 格式化新闻为消息
 */
function formatNewsMessage(newsList) {
  if (!newsList || newsList.length === 0) {
    return '今日暂无最新资讯推送';
  }

  let message = '📰 电信行业每日资讯\n';
  message += '━━━━━━━━━━━━━━━━━━━━\n\n';

  newsList.forEach((news, index) => {
    message += `${index + 1}. ${news.title}\n`;
    message += `   📅 ${news.date} | ${news.source}\n`;
    if (news.link) {
      message += `   🔗 ${news.link}\n`;
    }
    message += '\n';
  });

  message += '━━━━━━━━━━━━━━━━━━━━\n';
  message += `📅 ${moment().format('YYYY年MM月DD日 dddd')}`;

  return message;
}

module.exports = {
  fetchAllNews,
  formatNewsMessage,
  NEWS_SOURCES,
};