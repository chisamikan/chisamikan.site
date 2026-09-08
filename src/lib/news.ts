import {
  getGalleryItems,
  getNovelItems,
  getToolboxItems,
  getWorkHistory,
  getManualNewsItems,
} from './notion';
import { getFeedItems } from './rss';
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

  type RawNewsItem = Omit<NewsFeedItem, 'date'> & { date: string | null };

  const items: RawNewsItem[] = [
    ...gallery.map((item) => ({
      id: `gallery-${item.id}`,
      category: 'site' as const,
      title: `ギャラリーに『${item.title}』を追加しました`,
      body: null,
      date: item.createdTime,
      link: `/gallery#gallery-${item.id}`,
      external: false,
    })),
    ...novels.map((item) => ({
      id: `novel-${item.id}`,
      category: 'site' as const,
      title: `小説に『${item.title}』を追加しました`,
      body: null,
      date: item.createdTime,
      link: `/novels#novel-${item.id}`,
      external: false,
    })),
    ...toolbox.map((item) => ({
      id: `toolbox-${item.id}`,
      category: 'site' as const,
      title: `ツールボックスに『${item.title}』を追加しました`,
      body: null,
      date: item.createdTime,
      link: `/toolbox#toolbox-${item.id}`,
      external: false,
    })),
    ...works.map((item) => ({
      id: `work-${item.id}`,
      category: 'site' as const,
      title: `仕事履歴に『${item.client}』を追加しました`,
      body: null,
      date: item.createdTime,
      link: `/profile#work-${item.id}`,
      external: false,
    })),
    ...manual.map((item) => ({
      id: `manual-${item.id}`,
      category: 'manual' as const,
      title: item.title,
      body: item.body || null,
      date: item.date ?? item.createdTime,
      link: item.url,
      external: Boolean(item.url?.startsWith('http')),
    })),
    ...noteItems.map((item, index) => ({
      id: `note-${index}-${item.link}`,
      category: 'note' as const,
      title: item.title,
      body: null,
      date: item.date,
      link: item.link,
      external: true,
    })),
    ...zennItems.map((item, index) => ({
      id: `zenn-${index}-${item.link}`,
      category: 'zenn' as const,
      title: item.title,
      body: null,
      date: item.date,
      link: item.link,
      external: true,
    })),
  ];

  return items
    .filter((item): item is NewsFeedItem => Boolean(item.date))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
