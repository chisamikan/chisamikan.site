import {
  getGalleryItems,
  getNovelItems,
  getToolboxItems,
  getWorkHistory,
  getManualNewsItems,
} from './notion';
import Parser from 'rss-parser';
import { zennFeedUrl } from './config';

export type NewsCategory = 'site' | 'note' | 'zenn' | 'manual';

export interface NewsFeedItem {
  id: string;
  category: NewsCategory;
  title: string;
  body: string | null;
  date: string;
  link: string | null;
  external: boolean;
}

export interface NewsCategoryMeta {
  value: NewsCategory;
  label: string;
  icon: string;
}

export const newsCategories: NewsCategoryMeta[] = [
  { value: 'site', label: 'サイト更新', icon: 'fa-solid fa-screwdriver-wrench' },
  { value: 'note', label: 'お知らせ(note)', icon: 'fa-solid fa-bullhorn' },
  { value: 'zenn', label: '技術記事(Zenn)', icon: 'fa-solid fa-code' },
  { value: 'manual', label: 'その他', icon: 'fa-solid fa-ellipsis' },
];

export function getCategoryMeta(category: NewsCategory): NewsCategoryMeta {
  return newsCategories.find((c) => c.value === category)!;
}

// 外部フィード(note/Zenn)から統合お知らせに取り込む件数の上限
const EXTERNAL_FEED_LIMIT = 30;

// 見出しに列記するタイトルの上限。超えた分は「など○点」のようにまとめる
const GROUPED_TITLE_LIMIT = 3;

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

type RawNewsItem = Omit<NewsFeedItem, 'date'> & { date: string | null };

interface GroupableSiteItem {
  id: string;
  name: string;
  createdTime: string;
}

interface SiteNewsGroupConfig {
  idPrefix: string;
  label: string;
  unit: string;
  basePath: string;
}

// Notionのcreated_time(UTC)を日本時間の日付キー(YYYY-MM-DD)に変換する
function toJstDateKey(iso: string): string {
  return new Date(new Date(iso).getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

function buildGroupedTitle(names: string[], label: string, unit: string): string {
  const shown = names.slice(0, GROUPED_TITLE_LIMIT).map((name) => `『${name}』`).join('');
  const rest = names.length > GROUPED_TITLE_LIMIT ? `など${names.length}${unit}` : '';
  return `${label}に${shown}${rest}を追加しました`;
}

// 同じ種類の項目を日本時間の同日でグルーピングし、複数件あれば1つのお知らせにまとめる
function buildSiteNewsItems(items: GroupableSiteItem[], config: SiteNewsGroupConfig): RawNewsItem[] {
  const groups = Map.groupBy(items, (item) => toJstDateKey(item.createdTime));

  return Array.from(groups.values()).map((group) => {
    if (group.length === 1) {
      const item = group[0];
      return {
        id: `${config.idPrefix}-${item.id}`,
        category: 'site' as const,
        title: `${config.label}に『${item.name}』を追加しました`,
        body: null,
        date: item.createdTime,
        link: `${config.basePath}#${config.idPrefix}-${item.id}`,
        external: false,
      };
    }
    const latest = group.reduce((a, b) => (a.createdTime > b.createdTime ? a : b));
    return {
      id: `${config.idPrefix}-group-${toJstDateKey(latest.createdTime)}`,
      category: 'site' as const,
      title: buildGroupedTitle(group.map((item) => item.name), config.label, config.unit),
      body: null,
      date: latest.createdTime,
      link: config.basePath,
      external: false,
    };
  });
}

interface NewsItem {
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
async function getFeedItems(feedUrl: string, limit: number): Promise<NewsItem[]> {
  try {
    const feed = await parser.parseURL(feedUrl);
    return (feed.items ?? []).slice(0, limit).map((item) => ({
      title: item.title?.trim() ?? '(無題)',
      link: item.link ?? '#',
      date: item.isoDate ?? item.pubDate ?? null,
    }));
  } catch (err) {
    console.error(`[rss] フィードの取得に失敗しました (${feedUrl}):`, err);
    return [];
  }
}

function toFeedNewsItems(items: NewsItem[], category: 'note' | 'zenn'): RawNewsItem[] {
  return items.map((item, index) => ({
    id: `${category}-${index}-${item.link}`,
    category,
    title: item.title,
    body: null,
    date: item.date,
    link: item.link,
    external: true,
  }));
}

/**
 * Notion 4DB(ギャラリー/小説/ツールボックス/仕事履歴)・手動投稿DB・note・Zenn の
 * 更新情報を1つの時系列リストに統合します。ビルド時に取得するため、
 * 反映には再ビルドが必要です(既存のNotion/RSS取得と同じ制約)。
 */
export async function getAllNewsItems(): Promise<NewsFeedItem[]> {
  const noteFeedUrl = import.meta.env.RSS_FEED_URL;

  const [gallery, novels, toolbox, works, manual, noteItems, zennItems] = await Promise.all([
    getGalleryItems(),
    getNovelItems(),
    getToolboxItems(),
    getWorkHistory(),
    getManualNewsItems(),
    noteFeedUrl ? getFeedItems(noteFeedUrl, EXTERNAL_FEED_LIMIT) : Promise.resolve([]),
    getFeedItems(zennFeedUrl, EXTERNAL_FEED_LIMIT),
  ]);

  const items: RawNewsItem[] = [
    ...buildSiteNewsItems(
      gallery.map((item) => ({ id: item.id, name: item.title, createdTime: item.createdTime })),
      { idPrefix: 'gallery', label: 'ギャラリー', unit: '点', basePath: '/gallery' },
    ),
    ...buildSiteNewsItems(
      novels.map((item) => ({ id: item.id, name: item.title, createdTime: item.createdTime })),
      { idPrefix: 'novel', label: '小説', unit: '作', basePath: '/novels' },
    ),
    ...buildSiteNewsItems(
      toolbox.map((item) => ({ id: item.id, name: item.title, createdTime: item.createdTime })),
      { idPrefix: 'toolbox', label: 'ツールボックス', unit: '点', basePath: '/toolbox' },
    ),
    ...buildSiteNewsItems(
      works.map((item) => ({ id: item.id, name: item.client, createdTime: item.createdTime })),
      { idPrefix: 'work', label: '仕事履歴', unit: '件', basePath: '/profile' },
    ),
    ...manual.map((item) => ({
      id: `manual-${item.id}`,
      category: 'manual' as const,
      title: item.title,
      body: item.body || null,
      date: item.date ?? item.createdTime,
      link: item.url,
      external: Boolean(item.url?.startsWith('http')),
    })),
    ...toFeedNewsItems(noteItems, 'note'),
    ...toFeedNewsItems(zennItems, 'zenn'),
  ];

  return items
    .filter((item): item is NewsFeedItem => Boolean(item.date))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
