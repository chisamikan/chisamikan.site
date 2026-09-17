import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getAllNewsItems, getCategoryMeta } from '../lib/news';
import { site } from '../lib/config';

export async function GET(context: APIContext) {
  const items = await getAllNewsItems();

  return rss({
    title: site.title,
    description: site.description,
    site: context.site ?? 'https://chisamikan.site',
    xmlns: { content: 'http://purl.org/rss/1.0/modules/content/' },
    // trailingSlash(既定true)は#gallery-xxxのようなハッシュ付きリンクの末尾にも
    // スラッシュを付けてしまい、アンカー(id)と一致しなくなるため無効化する
    trailingSlash: false,
    items: items.map((item) => ({
      title: item.title,
      description: item.body ?? undefined,
      pubDate: new Date(item.date),
      // リンク先の無いお知らせ(手動投稿など)は/newsへのリンクにフォールバックする
      link: item.link ?? '/news',
      categories: [getCategoryMeta(item.category).label],
    })),
    customData: '<language>ja</language>',
  });
}
