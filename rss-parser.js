let Parser = require('rss-parser');
const fs = require('fs');
const https = require('https');

const RSS_URL = 'https://rsshub-vercel-chisamikan.vercel.app/fanbox/chisamikan?sorted=false';

const siteConfig = {
  siteName: 'chisamikan.site',
  siteRootUrl: 'https://chisamikan.site/',
  ogImageUrl: 'https://chisamikan.site/images/og-image.jpg',
  fbAppId: '',
  twitterSite: '@chisamikan',
  googleAnalyticsId: 'G-XZSD8BQ5DE',
};

// リトライすべきステータスコード（一時的なエラー）
const RETRYABLE_STATUS = [429, 500, 502, 503, 504];

function fetchXml(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) return reject(new Error('Too many redirects'));

    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RSSParser/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
      timeout: 10000,
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        return resolve(fetchXml(res.headers.location, redirectCount + 1));
      }

      // リトライ対象のステータスはエラーとして投げる
      if (RETRYABLE_STATUS.includes(res.statusCode)) {
        res.resume(); // レスポンスボディを消費してソケットを解放
        return reject(new Error(`HTTP ${res.statusCode}`));
      }

      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} (非リトライ)`));
      }

      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });

    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
    req.on('error', reject);
  });
}

async function fetchWithRetry(url, maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`RSSフィード取得中... (試行 ${attempt}/${maxRetries})`);
      const xml = await fetchXml(url);
      return xml;
    } catch (err) {
      console.warn(`試行 ${attempt} 失敗: ${err.message}`);
      if (attempt < maxRetries) {
        const wait = attempt * 2000; // 2秒、4秒、6秒...と増やす
        console.log(`${wait / 1000}秒後にリトライします...`);
        await new Promise(resolve => setTimeout(resolve, wait));
      } else {
        throw err;
      }
    }
  }
}

(async () => {
  let feed;

  try {
    const xml = await fetchWithRetry(RSS_URL);
    const parser = new Parser();
    feed = await parser.parseString(xml);
    feed.items.length = 5;
    console.log('RSSフィードの取得に成功しました。');
  } catch (err) {
    console.warn(`RSSフィードの取得に最終的に失敗しました。空のフィードで続行します。\nエラー: ${err.message}`);
    feed = { items: [] };
  }

  Object.assign(feed, siteConfig);

  fs.writeFile('site.json', JSON.stringify(feed, null, '    '), (err) => {
    if (err) console.log(`error!::${err}`);
  });
})();