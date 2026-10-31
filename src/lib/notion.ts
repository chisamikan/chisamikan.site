import { isFullDatabase, isFullPage, iteratePaginatedAPI } from '@notionhq/client';
import type { PageObjectResponse, QueryDataSourceParameters } from '@notionhq/client/build/src/api-endpoints';
import { createNotionClient, type ImageKind } from './notionClient';
import { safeLinkUrl } from './url';

// ビルド時(静的ページの生成)専用のモジュール。Workerで動くAPIルートからは import しないこと
// (import.meta.env.NOTION_TOKEN がWorkerのコードに平文で埋め込まれてしまうため)。
// トークンが無い場合はエラーで止めず空の一覧を返す
const token = import.meta.env.NOTION_TOKEN;

export const notion = token ? createNotionClient(token) : null;

function warnMissingToken(context: string) {
  console.warn(`[notion] NOTION_TOKEN が設定されていないため "${context}" は空で表示します。`);
}

// --- 型定義 -----------------------------------------------------------------

export interface ArtworkItem {
  id: string;
  title: string;
  imageUrl: string | null;
  tags: string[];
  description: string;
  date: string | null;
  nsfw: boolean;
  slideshow: boolean;
  url: string | null;
  createdTime: string;
}

export interface ToolboxItem {
  id: string;
  title: string;
  url: string | null;
  imageUrl: string | null;
  description: string;
  createdTime: string;
}

export interface NovelItem {
  id: string;
  title: string;
  imageUrl: string | null;
  tags: string[];
  description: string;
  kakuyomuUrl: string | null;
  pixivUrl: string | null;
  shopUrl: string | null;
  createdTime: string;
}

export interface WorkItem {
  id: string;
  client: string;
  role: string;
  periodStart: string | null;
  periodEnd: string | null;
  url: string | null;
  imageUrl: string | null;
  tags: string[];
  createdTime: string;
}

export interface ManualNewsItem {
  id: string;
  title: string;
  body: string;
  // 個別ページで本文中のリンクを再現するための、テキストとリンク先の組
  bodySegments: { text: string; href: string | null }[];
  date: string | null;
  url: string | null;
  createdTime: string;
}

type Props = PageObjectResponse['properties'];

function richTextToPlain(richText: { plain_text: string }[]): string {
  return richText.map((t) => t.plain_text).join('');
}

function titleProp(props: Props, key: string, fallback = '(無題)'): string {
  const prop = props[key];
  return prop?.type === 'title' ? richTextToPlain(prop.title) : fallback;
}

function richTextProp(props: Props, key: string): string {
  const prop = props[key];
  return prop?.type === 'rich_text' ? richTextToPlain(prop.rich_text) : '';
}

function urlProp(props: Props, key: string): string | null {
  const prop = props[key];
  return prop?.type === 'url' ? safeLinkUrl(prop.url) : null;
}

function dateProp(props: Props, key: string) {
  const prop = props[key];
  return prop?.type === 'date' ? prop.date : null;
}

function checkboxProp(props: Props, key: string): boolean {
  const prop = props[key];
  return prop?.type === 'checkbox' ? prop.checkbox : false;
}

function tagsProp(props: Props): string[] {
  const prop = props.Tags;
  return prop?.type === 'multi_select' ? prop.multi_select.map((t) => t.name) : [];
}

// Notionへアップロードした画像(file.type === 'file')のURLは数時間で失効するため、
// リクエストの都度最新URLを取得し直す /api/image/[kind]/[id] 経由に差し替える。
// 外部URL(file.type === 'external')は失効しないためそのまま使用する。
function imageProp(page: PageObjectResponse, kind: ImageKind): string | null {
  const prop = page.properties.Image;
  if (prop?.type !== 'files' || prop.files.length === 0) return null;
  const file = prop.files[0];
  return file.type === 'external' ? file.external.url : `/api/image/${kind}/${page.id}`;
}

// Notion APIはデータベースを直接クエリできないため、まずデータソースIDを取得してからクエリする。
// 1回の取得上限は100件のため、iteratePaginatedAPIで全ページを辿って全件取得する。
async function queryDatabase(
  dbId: string,
  options: Omit<QueryDataSourceParameters, 'data_source_id'> = {}
): Promise<PageObjectResponse[]> {
  const db = await notion!.databases.retrieve({ database_id: dbId });
  if (!isFullDatabase(db) || db.data_sources.length === 0) {
    throw new Error(`Notionデータベース(${dbId})のデータソースを取得できませんでした。`);
  }

  const results: PageObjectResponse[] = [];
  for await (const page of iteratePaginatedAPI(notion!.dataSources.query, {
    data_source_id: db.data_sources[0].id,
    ...options,
  })) {
    if (isFullPage(page)) {
      results.push(page);
    }
  }

  return results;
}

function queryPublishedDatabase(dbId: string, sortProperty: string): Promise<PageObjectResponse[]> {
  return queryDatabase(dbId, {
    filter: { property: 'Published', checkbox: { equals: true } },
    sorts: [{ property: sortProperty, direction: 'descending' }],
  });
}

function queryByCreatedTime(dbId: string): Promise<PageObjectResponse[]> {
  return queryDatabase(dbId, { sorts: [{ timestamp: 'created_time', direction: 'descending' }] });
}

// --- ギャラリー ---------------------------------------------------------------

/**
 * ギャラリー用データベースを取得します。
 * Notion側のプロパティ名(想定):
 *   Name(title) / Image(files) / Tags(multi_select) / Description(rich_text) /
 *   Date(date) / Published(checkbox) / NSFW(checkbox) / Slideshow(checkbox) /
 *   URL(url, 未入力なら非表示)
 */
export async function getGalleryItems(): Promise<ArtworkItem[]> {
  const dbId = import.meta.env.NOTION_GALLERY_DB_ID;
  if (!notion || !dbId) {
    warnMissingToken('ギャラリー');
    return [];
  }

  const pages = await queryPublishedDatabase(dbId, 'Date');
  return pages.map((page) => {
    const props = page.properties;
    return {
      id: page.id,
      title: titleProp(props, 'Name'),
      imageUrl: imageProp(page, 'gallery'),
      tags: tagsProp(props),
      description: richTextProp(props, 'Description'),
      date: dateProp(props, 'Date')?.start ?? null,
      nsfw: checkboxProp(props, 'NSFW'),
      slideshow: checkboxProp(props, 'Slideshow'),
      url: urlProp(props, 'URL'),
      createdTime: page.created_time,
    };
  });
}

// --- 小説 ---------------------------------------------------------------------

/**
 * 小説用データベースを取得します。
 * Notion側のプロパティ名(想定):
 *   Name(title) / Image(files) / Description(rich_text) / Tags(multi_select) /
 *   kakuyomu(url, 未入力なら非表示) / pixiv(url, 未入力なら非表示) / shop(url, 未入力なら非表示)
 * (他のデータベースと異なり Published プロパティは前提にせず、作成日時の新しい順に全件取得する)
 */
export async function getNovelItems(): Promise<NovelItem[]> {
  const dbId = import.meta.env.NOTION_NOVELS_DB_ID;
  if (!notion || !dbId) {
    warnMissingToken('小説');
    return [];
  }

  const pages = await queryByCreatedTime(dbId);
  return pages.map((page) => {
    const props = page.properties;
    return {
      id: page.id,
      title: titleProp(props, 'Name'),
      imageUrl: imageProp(page, 'novels'),
      tags: tagsProp(props),
      description: richTextProp(props, 'Description'),
      kakuyomuUrl: urlProp(props, 'kakuyomu'),
      pixivUrl: urlProp(props, 'pixiv'),
      shopUrl: urlProp(props, 'shop'),
      createdTime: page.created_time,
    };
  });
}

// --- 仕事履歴 -----------------------------------------------------------------

/**
 * 仕事履歴用データベースを取得します。
 * Notion側のプロパティ名(想定):
 *   Client(title) / Role(rich_text) / Period(date, endを含む範囲) /
 *   URL(url) / Image(files) / Tags(multi_select) / Published(checkbox)
 */
export async function getWorkHistory(): Promise<WorkItem[]> {
  const dbId = import.meta.env.NOTION_WORKS_DB_ID;
  if (!notion || !dbId) {
    warnMissingToken('仕事履歴');
    return [];
  }

  const pages = await queryPublishedDatabase(dbId, 'Period');
  return pages.map((page) => {
    const props = page.properties;
    const period = dateProp(props, 'Period');
    return {
      id: page.id,
      client: titleProp(props, 'Client', '(無題の案件)'),
      role: richTextProp(props, 'Role'),
      periodStart: period?.start ?? null,
      periodEnd: period?.end ?? null,
      url: urlProp(props, 'URL'),
      imageUrl: imageProp(page, 'works'),
      tags: tagsProp(props),
      createdTime: page.created_time,
    };
  });
}

// --- ツールボックス -------------------------------------------------------------

/**
 * ツールボックス用データベースを取得します。
 * Notion側のプロパティ名(想定):
 *   Name(title) / URL(url) / Image(files) / Description(rich_text)
 * (他のデータベースと異なり Published プロパティは前提にせず、作成日時の新しい順に全件取得する)
 */
export async function getToolboxItems(): Promise<ToolboxItem[]> {
  const dbId = import.meta.env.NOTION_TOOLBOX_DB_ID;
  if (!notion || !dbId) {
    warnMissingToken('ツールボックス');
    return [];
  }

  const pages = await queryByCreatedTime(dbId);
  return pages.map((page) => {
    const props = page.properties;
    return {
      id: page.id,
      title: titleProp(props, 'Name'),
      url: urlProp(props, 'URL'),
      imageUrl: imageProp(page, 'toolbox'),
      description: richTextProp(props, 'Description'),
      createdTime: page.created_time,
    };
  });
}

// --- お知らせ(手動投稿) ---------------------------------------------------------

/**
 * 手動投稿用データベースを取得します。
 * Notion側のプロパティ名(想定):
 *   Name(title) / Body(rich_text) / Date(date) / Published(checkbox) / URL(url, 未入力なら非表示)
 */
export async function getManualNewsItems(): Promise<ManualNewsItem[]> {
  const dbId = import.meta.env.NOTION_NEWS_DB_ID;
  if (!notion || !dbId) {
    warnMissingToken('お知らせ(手動投稿)');
    return [];
  }

  const pages = await queryPublishedDatabase(dbId, 'Date');
  return pages.map((page) => {
    const props = page.properties;
    return {
      id: page.id,
      title: titleProp(props, 'Name'),
      body: richTextProp(props, 'Body'),
      bodySegments:
        props.Body?.type === 'rich_text'
          ? props.Body.rich_text.map((t) => ({ text: t.plain_text, href: safeLinkUrl(t.href) }))
          : [],
      date: dateProp(props, 'Date')?.start ?? null,
      url: urlProp(props, 'URL'),
      createdTime: page.created_time,
    };
  });
}

// --- おみくじ -----------------------------------------------------------------

export interface OmikujiItem {
  id: string;
  fortune: string;
  overall: string;
  wish: string;
  waitingPerson: string;
  lostItem: string;
  travel: string;
  business: string;
  study: string;
  love: string;
  moving: string;
  illness: string;
  direction: string;
}

/**
 * おみくじ用データベースを取得します(404ページで使用)。
 * Notion側のプロパティ名(想定): 運勢(title) / 全体運・願望・待人・失物・旅行・
 * 商売・学問・恋愛・転居・病気・方位(いずれもrich_text)
 * (件数が少なく全件をその都度ランダム抽選したいため、Published等のフィルタは設けず全件取得する)
 */
export async function getOmikujiItems(): Promise<OmikujiItem[]> {
  const dbId = import.meta.env.NOTION_OMIKUJI_DB_ID;
  if (!notion || !dbId) {
    warnMissingToken('おみくじ');
    return [];
  }

  const pages = await queryDatabase(dbId);
  return pages.map((page) => {
    const props = page.properties;
    return {
      id: page.id,
      fortune: titleProp(props, '運勢'),
      overall: richTextProp(props, '全体運'),
      wish: richTextProp(props, '願望'),
      waitingPerson: richTextProp(props, '待人'),
      lostItem: richTextProp(props, '失物'),
      travel: richTextProp(props, '旅行'),
      business: richTextProp(props, '商売'),
      study: richTextProp(props, '学問'),
      love: richTextProp(props, '恋愛'),
      moving: richTextProp(props, '転居'),
      illness: richTextProp(props, '病気'),
      direction: richTextProp(props, '方位'),
    };
  });
}
