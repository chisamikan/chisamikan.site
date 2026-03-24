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

// HTTPSでRSSを直接取得する関数（リダイレクト対応）
function fetchXml(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) return reject(new Error('Too many redirects'));

    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RSSParser/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
    }, (res) => {
      // リダイレクト処理
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        return resolve(fetchXml(res.headers.location, redirectCount + 1));
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }

      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });

    req.on('error', reject);
  });
}

(async () => {
  let feed;

  try {
    const xml = await fetchXml(RSS_URL);
    const parser = new Parser();
    feed = await parser.parseString(xml);
    feed.items.length = 5; // 一度に表示する件数
    console.log('RSSフィードの取得に成功しました。');
  } catch (err) {
    console.warn(`RSSフィードの取得に失敗しました。空のフィードで続行します。\nエラー: ${err.message}`);
    feed = { items: [] };
  }

  Object.assign(feed, siteConfig);

  fs.writeFile('site.json', JSON.stringify(feed, null, '    '), (err) => {
    if (err) console.log(`error!::${err}`);
  });
})();