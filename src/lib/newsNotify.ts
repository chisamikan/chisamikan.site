// お知らせ(/rss.xml)の新着をDiscordのチャンネルへ通知する。
// Cron Trigger(src/worker.ts)から呼ばれ、前回までに見た記事をKVに覚えておき、増えた分だけを送る。
import { decodeEntities } from './decodeEntities';
import { notifyDiscord } from './notify';

interface FeedItem {
  title: string;
  link: string;
  pubDate: Date;
  category: string | null;
}

// 通知済みの記事キーを保存するKVのキー(アクセスカウンターと同じnamespaceを共用する)
const SEEN_KEY = 'news-notify:seen';

// 覚えておく記事キーの上限。古いものから捨てる
const SEEN_LIMIT = 1000;

// これより古い日付の記事は、初めて見ても通知しない
// (Notion取得の一時的な失敗からの復帰や、過去の投稿のタイトル修正で昔の記事が流れるのを防ぐ)
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

// 投稿時にカテゴリ名を付けないカテゴリ
const HIDDEN_CATEGORY = 'その他';

function pickTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return match ? decodeEntities(match[1]).trim() : null;
}

// 自サイトの@astrojs/rssが出力する形式だけを想定した、最小限のRSSパーサー
// (Workers上ではrss-parserやDOMParserが使えないため)
function parseFeed(xml: string): FeedItem[] {
  return Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/g)).flatMap(([, itemXml]) => {
    const title = pickTag(itemXml, 'title');
    const link = pickTag(itemXml, 'link');
    const pubDate = new Date(pickTag(itemXml, 'pubDate') ?? '');
    if (!title || !link || Number.isNaN(pubDate.getTime())) return [];
    return [{
      title,
      link,
      pubDate,
      category: pickTag(itemXml, 'category'),
    }];
  });
}

// 同じ日に追加したギャラリー等はまとめて同じリンク(/gallery など)になるため、リンクだけでなくタイトルも含めて区別する
function itemKey(item: FeedItem): string {
  return `${item.link}\n${item.title}`;
}

// 「カテゴリ: タイトル」と「リンク」の2行にする(「その他」はカテゴリを付けない)
function formatItem(item: FeedItem): string {
  const heading = item.category && item.category !== HIDDEN_CATEGORY ? `${item.category}: ${item.title}` : item.title;
  return `${heading}\n${item.link}`;
}

/**
 * 公開中の/rss.xmlを読み、前回から増えたお知らせをDiscordへ通知します。
 * 初回(KVに記録が無い時)は今ある記事を記録するだけで、通知はしません。
 */
export async function notifyNewNews(assets: Fetcher, kv: KVNamespace, webhookUrl: string): Promise<void> {
  // 静的に生成済みのrss.xmlを、自分自身へのHTTPリクエストを介さずASSETSから直接読む
  const res = await assets.fetch('https://chisamikan.site/rss.xml');
  if (!res.ok) throw new Error(`rss.xmlの取得に失敗しました(HTTP ${res.status})`);
  const items = parseFeed(await res.text());

  const stored = await kv.get<string[]>(SEEN_KEY, 'json');
  const seen = new Set(stored ?? []);
  const now = Date.now();
  const newItems = stored
    ? items
        .filter((item) => !seen.has(itemKey(item)) && now - item.pubDate.getTime() <= MAX_AGE_MS)
        .sort((a, b) => a.pubDate.getTime() - b.pubDate.getTime())
    : [];

  // 古い順に1件ずつ、1件1メッセージで送る。途中で失敗した時は、送れた分だけ記録して残りは次回のCronで送り直す
  // (一時的にフィードから消えた記事が復帰した時に再通知しないよう、過去の記録も残しておく)
  try {
    for (const item of newItems) {
      await notifyDiscord(formatItem(item), webhookUrl);
      seen.add(itemKey(item));
    }
    items.forEach((item) => seen.add(itemKey(item)));
  } finally {
    await kv.put(SEEN_KEY, JSON.stringify([...seen].slice(-SEEN_LIMIT)));
  }
}
