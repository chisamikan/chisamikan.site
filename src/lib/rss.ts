import Parser from 'rss-parser';

export interface NewsItem {
  title: string;
  link: string;
  date: string | null;
}

const parser = new Parser();

/**
 * 指定したRSSフィードから記事(タイトル・日付・リンク)を取得します。
 * ビルド時に取得するため、更新を反映するには再デプロイ(再ビルド)が必要です。
 * (Cloudflare Pages の Deploy Hooks + 定期実行で自動再ビルドさせる運用がおすすめです)
 */
export async function getFeedItems(feedUrl: string, limit = 10): Promise<NewsItem[]> {
  try {
    const feed = await parser.parseURL(feedUrl);
    return (feed.items ?? [])
      .slice(0, limit)
      .map((item) => ({
        title: item.title?.trim() ?? '(無題)',
        link: item.link ?? '#',
        date: item.isoDate ?? item.pubDate ?? null,
      }));
  } catch (err) {
    console.error(`[rss] フィードの取得に失敗しました (${feedUrl}):`, err);
    return [];
  }
}
