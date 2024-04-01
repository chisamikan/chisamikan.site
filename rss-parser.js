let Parser = require('rss-parser');
const fs = require('fs');
let parser = new Parser({
  headers: { 'User-Agent': 'something different' },
});

(async () => {
  let feed = await parser.parseURL('https://hub.slarker.me/fanbox/chisamikan');

  feed.items.length = 5; //一度に表示する件数
  (feed.siteName = 'chisamikan.site'),
    (feed.siteRootUrl = 'https://chisamikan.site/'),
    (feed.ogImageUrl = feed.siteRootUrl + 'images/og-image.jpg'),
    (feed.fbAppId = ''),
    (feed.twitterSite = '@chisamikan'),
    (feed.googleAnalyticsId = 'G-XZSD8BQ5DE'),
    fs.writeFile('site.json', JSON.stringify(feed, null, '    '), (err) => {
      if (err) console.log(`error!::${err}`);
    });
})();
