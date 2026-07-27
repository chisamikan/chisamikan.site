import { Client, isFullDatabase, isFullPage, iteratePaginatedAPI } from '@notionhq/client';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';

// ---------------------------------------------------------------------------
// Notionクライアント
// ビルド時(SSG)にコンテンツを取得するため、トークンが無い場合は
// エラーで止めずに空データを返し、ローカルでもUIの見た目を確認できるようにします。
// ---------------------------------------------------------------------------
const token = import.meta.env.NOTION_TOKEN;

export const notion = token ? new Client({ auth: token, fetch: fetch.bind(globalThis) }) : null;

function warnMissingToken(context: string) {
  console.warn(
    `[notion] NOTION_TOKEN が設定されていないため "${context}" はダミーデータで表示します。`
  );
}

// ---------------------------------------------------------------------------
// Notionへ独自にアップロードした画像(file.type === 'file')のURLは
// 署名付きで数時間程度で失効し、ビルド時(SSG)に埋め込むと表示されなくなる。
// そのためURLをそのまま使わず、リクエストの都度Notionから最新URLを
// 取得し直す /api/image/[kind]/[id] 経由のパスに差し替える。
// (外部URL(file.type === 'external')は失効しないためそのまま使用する)
// ---------------------------------------------------------------------------
function imageProxyUrl(
  kind: 'gallery' | 'works' | 'profile' | 'toolbox' | 'novels' | 'omikuji',
  id: string
): string {
  return `/api/image/${kind}/${id}`;
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
}

export interface ToolboxItem {
  id: string;
  title: string;
  url: string | null;
  imageUrl: string | null;
  description: string;
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
}

function richTextToPlain(richText: { plain_text: string }[]): string {
  return richText.map((t) => t.plain_text).join('');
}

function richTextProp(props: PageObjectResponse['properties'], key: string): string {
  const prop = props[key];
  return prop?.type === 'rich_text' ? richTextToPlain(prop.rich_text) : '';
}

// ---------------------------------------------------------------------------
// Notion API はデータベースを直接クエリする方式を廃止し、データベース配下の
// データソースをクエリする方式(dataSources.query)に変更された。
// そのためデータベースIDからまずデータソースIDを取得してからクエリする。
// クエリ結果は1回のリクエストにつき最大100件までしか返らないため、
// iteratePaginatedAPIで全ページを辿って全件取得する。
// ---------------------------------------------------------------------------
async function queryPublishedDatabase(
  dbId: string,
  sortProperty: string
): Promise<PageObjectResponse[]> {
  const db = await notion!.databases.retrieve({ database_id: dbId });
  if (!isFullDatabase(db) || db.data_sources.length === 0) {
    throw new Error(`Notionデータベース(${dbId})のデータソースを取得できませんでした。`);
  }

  const results: PageObjectResponse[] = [];
  for await (const page of iteratePaginatedAPI(notion!.dataSources.query, {
    data_source_id: db.data_sources[0].id,
    filter: { property: 'Published', checkbox: { equals: true } },
    sorts: [{ property: sortProperty, direction: 'descending' }],
  })) {
    if (isFullPage(page)) {
      results.push(page);
    }
  }

  return results;
}

// --- ギャラリー ---------------------------------------------------------------

/**
 * ギャラリー用データベースを取得します。
 * Notion側のプロパティ名(想定):
 *   Name(title) / Image(files) / Tags(multi_select) / Description(rich_text) /
 *   Date(date) / Published(checkbox) / NSFW(checkbox) / Slideshow(checkbox)
 */
export async function getGalleryItems(): Promise<ArtworkItem[]> {
  const dbId = import.meta.env.NOTION_GALLERY_DB_ID;
  if (!notion || !dbId) {
    warnMissingToken('ギャラリー');
    return sampleGallery;
  }

  const pages = await queryPublishedDatabase(dbId, 'Date');

  return pages.map(pageToArtwork);
}

function pageToArtwork(page: PageObjectResponse): ArtworkItem {
  const props = page.properties;

  const title =
    props.Name?.type === 'title' ? richTextToPlain(props.Name.title) : '(無題)';

  let imageUrl: string | null = null;
  if (props.Image?.type === 'files' && props.Image.files.length > 0) {
    const file = props.Image.files[0];
    imageUrl = file.type === 'external' ? file.external.url : imageProxyUrl('gallery', page.id);
  }

  const tags =
    props.Tags?.type === 'multi_select' ? props.Tags.multi_select.map((t) => t.name) : [];

  const description =
    props.Description?.type === 'rich_text' ? richTextToPlain(props.Description.rich_text) : '';

  const date = props.Date?.type === 'date' ? (props.Date.date?.start ?? null) : null;

  const nsfw = props.NSFW?.type === 'checkbox' ? props.NSFW.checkbox : false;

  const slideshow =
    props.Slideshow?.type === 'checkbox' ? props.Slideshow.checkbox : false;

  return { id: page.id, title, imageUrl, tags, description, date, nsfw, slideshow };
}

const sampleGallery: ArtworkItem[] = [
  {
    id: 'sample-1',
    title: '(サンプル) 朝の光',
    imageUrl: null,
    tags: ['キャラクター', '朝'],
    description: 'NOTION_GALLERY_DB_ID を設定するとNotionの作品がここに並びます。',
    date: '2026-01-01',
    nsfw: false,
    slideshow: true,
  },
];

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
    return sampleNovels;
  }

  const db = await notion.databases.retrieve({ database_id: dbId });
  if (!isFullDatabase(db) || db.data_sources.length === 0) {
    throw new Error(`Notionデータベース(${dbId})のデータソースを取得できませんでした。`);
  }

  const pages: PageObjectResponse[] = [];
  for await (const page of iteratePaginatedAPI(notion.dataSources.query, {
    data_source_id: db.data_sources[0].id,
    sorts: [{ timestamp: 'created_time', direction: 'descending' }],
  })) {
    if (isFullPage(page)) {
      pages.push(page);
    }
  }

  return pages.map(pageToNovel);
}

function pageToNovel(page: PageObjectResponse): NovelItem {
  const props = page.properties;

  const title =
    props.Name?.type === 'title' ? richTextToPlain(props.Name.title) : '(無題)';

  let imageUrl: string | null = null;
  if (props.Image?.type === 'files' && props.Image.files.length > 0) {
    const file = props.Image.files[0];
    imageUrl = file.type === 'external' ? file.external.url : imageProxyUrl('novels', page.id);
  }

  const tags =
    props.Tags?.type === 'multi_select' ? props.Tags.multi_select.map((t) => t.name) : [];

  const description =
    props.Description?.type === 'rich_text' ? richTextToPlain(props.Description.rich_text) : '';

  const kakuyomuUrl = props.kakuyomu?.type === 'url' ? props.kakuyomu.url : null;

  const pixivUrl = props.pixiv?.type === 'url' ? props.pixiv.url : null;

  const shopUrl = props.shop?.type === 'url' ? props.shop.url : null;

  return { id: page.id, title, imageUrl, tags, description, kakuyomuUrl, pixivUrl, shopUrl };
}

const sampleNovels: NovelItem[] = [
  {
    id: 'sample-novel-1',
    title: '(サンプル) 星の欠片',
    imageUrl: null,
    tags: ['ファンタジー'],
    description: 'NOTION_NOVELS_DB_ID を設定するとNotionの小説作品がここに並びます。',
    kakuyomuUrl: null,
    pixivUrl: null,
    shopUrl: null,
  },
];

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
    return sampleWorks;
  }

  const pages = await queryPublishedDatabase(dbId, 'Period');

  return pages.map(pageToWork);
}

function pageToWork(page: PageObjectResponse): WorkItem {
  const props = page.properties;

  const client =
    props.Client?.type === 'title' ? richTextToPlain(props.Client.title) : '(無題の案件)';

  const role = props.Role?.type === 'rich_text' ? richTextToPlain(props.Role.rich_text) : '';

  const period = props.Period?.type === 'date' ? props.Period.date : null;

  const url = props.URL?.type === 'url' ? props.URL.url : null;

  let imageUrl: string | null = null;
  if (props.Image?.type === 'files' && props.Image.files.length > 0) {
    const file = props.Image.files[0];
    imageUrl = file.type === 'external' ? file.external.url : imageProxyUrl('works', page.id);
  }

  const tags =
    props.Tags?.type === 'multi_select' ? props.Tags.multi_select.map((t) => t.name) : [];

  return {
    id: page.id,
    client,
    role,
    periodStart: period?.start ?? null,
    periodEnd: period?.end ?? null,
    url,
    imageUrl,
    tags,
  };
}

const sampleWorks: WorkItem[] = [
  {
    id: 'sample-work-1',
    client: '(サンプル) 出版社A 書籍装画',
    role: 'カバーイラスト',
    periodStart: '2025-04-01',
    periodEnd: '2025-06-01',
    url: null,
    imageUrl: null,
    tags: ['装画', '書籍'],
  },
];

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
    return sampleToolbox;
  }

  const db = await notion.databases.retrieve({ database_id: dbId });
  if (!isFullDatabase(db) || db.data_sources.length === 0) {
    throw new Error(`Notionデータベース(${dbId})のデータソースを取得できませんでした。`);
  }

  const pages: PageObjectResponse[] = [];
  for await (const page of iteratePaginatedAPI(notion.dataSources.query, {
    data_source_id: db.data_sources[0].id,
    sorts: [{ timestamp: 'created_time', direction: 'descending' }],
  })) {
    if (isFullPage(page)) {
      pages.push(page);
    }
  }

  return pages.map(pageToToolbox);
}

function pageToToolbox(page: PageObjectResponse): ToolboxItem {
  const props = page.properties;

  const title =
    props.Name?.type === 'title' ? richTextToPlain(props.Name.title) : '(無題)';

  const url = props.URL?.type === 'url' ? props.URL.url : null;

  let imageUrl: string | null = null;
  if (props.Image?.type === 'files' && props.Image.files.length > 0) {
    const file = props.Image.files[0];
    imageUrl = file.type === 'external' ? file.external.url : imageProxyUrl('toolbox', page.id);
  }

  const description =
    props.Description?.type === 'rich_text' ? richTextToPlain(props.Description.rich_text) : '';

  return { id: page.id, title, url, imageUrl, description };
}

const sampleToolbox: ToolboxItem[] = [
  {
    id: 'sample-toolbox-1',
    title: '(サンプル) おすすめツール',
    url: null,
    imageUrl: null,
    description: 'NOTION_TOOLBOX_DB_ID を設定するとNotionのツールがここに並びます。',
  },
];

// --- お問い合わせ -------------------------------------------------------------

export interface ContactPayload {
  name: string;
  email: string;
  message: string;
}

/**
 * お問い合わせ内容をNotionデータベースに1件のページとして追加します。
 * Notion側のプロパティ名(想定):
 *   Name(title) / Email(email) / Message(rich_text) / ReceivedAt(date) / Status(select: "未対応")
 *
 * このAPIはCloudflare上でリクエストごとに実行されるため、ビルド時専用の import.meta.env ではなく
 * Cloudflareのランタイム環境(Astro.locals.runtime.env)から渡された値を優先して使用します。
 * (Cloudflareの設定によっては、ビルド時とリクエスト実行時で参照できる環境変数が異なる場合があるため)
 */
export async function createContactEntry(
  payload: ContactPayload,
  env?: { NOTION_TOKEN?: string; NOTION_CONTACT_DB_ID?: string }
): Promise<void> {
  const runtimeToken = env?.NOTION_TOKEN || import.meta.env.NOTION_TOKEN;
  const dbId = env?.NOTION_CONTACT_DB_ID || import.meta.env.NOTION_CONTACT_DB_ID;

  if (!runtimeToken || !dbId) {
    throw new Error(
      'NOTION_TOKEN / NOTION_CONTACT_DB_ID が設定されていないため、お問い合わせを送信できません。'
    );
  }

  const client = new Client({ auth: runtimeToken, fetch: fetch.bind(globalThis) });

  await client.pages.create({
    parent: { database_id: dbId },
    properties: {
      Name: { title: [{ text: { content: payload.name } }] },
      Email: { email: payload.email },
      Message: { rich_text: [{ text: { content: payload.message } }] },
      ReceivedAt: { date: { start: new Date().toISOString() } },
      Status: { select: { name: '未対応' } },
    },
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
    return sampleOmikuji;
  }

  const db = await notion.databases.retrieve({ database_id: dbId });
  if (!isFullDatabase(db) || db.data_sources.length === 0) {
    throw new Error(`Notionデータベース(${dbId})のデータソースを取得できませんでした。`);
  }

  const pages: PageObjectResponse[] = [];
  for await (const page of iteratePaginatedAPI(notion.dataSources.query, {
    data_source_id: db.data_sources[0].id,
  })) {
    if (isFullPage(page)) {
      pages.push(page);
    }
  }

  return pages.map(pageToOmikuji);
}

function pageToOmikuji(page: PageObjectResponse): OmikujiItem {
  const props = page.properties;

  const fortune =
    props['運勢']?.type === 'title' ? richTextToPlain(props['運勢'].title) : '(無題)';

  return {
    id: page.id,
    fortune,
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
}

const sampleOmikuji: OmikujiItem[] = [
  {
    id: 'sample-omikuji-1',
    fortune: '大吉',
    overall: '(サンプル) NOTION_OMIKUJI_DB_ID を設定するとNotionのおみくじ結果が抽選されます。',
    wish: '叶うでしょう',
    waitingPerson: '来るでしょう',
    lostItem: '出るでしょう',
    travel: '良し',
    business: '繁栄する',
    study: '励めば成る',
    love: '良縁あり',
    moving: '吉',
    illness: '治る',
    direction: '東',
  },
  {
    id: 'sample-omikuji-2',
    fortune: '中吉',
    overall: '(サンプル) NOTION_OMIKUJI_DB_ID を設定するとNotionのおみくじ結果が抽選されます。',
    wish: '叶うでしょう',
    waitingPerson: '来るでしょう',
    lostItem: '出るでしょう',
    travel: '良し',
    business: '繁栄する',
    study: '励めば成る',
    love: '良縁あり',
    moving: '吉',
    illness: '治る',
    direction: '南',
  },
];

// --- おみくじメッセージ(運勢ごとの一言・LINE風表示用) -----------------------------

export interface OmikujiMessageItem {
  id: string;
  fortune: string;
  imageUrl: string | null;
  message: string;
}

/**
 * おみくじの運勢ごとの一言メッセージ用データベースを取得します(404ページで使用)。
 * Notion側のプロパティ名(想定): 運勢(title) / 画像(files) / メッセージ(rich_text)
 * 抽選したおみくじ(getOmikujiItems)の fortune と、この運勢の文字列を完全一致させて
 * 対応するメッセージを1件引き当てる想定(件数は大吉～凶の数種類のみのため全件取得)。
 */
export async function getOmikujiMessageItems(): Promise<OmikujiMessageItem[]> {
  const dbId = import.meta.env.NOTION_OMIKUJI_MESSAGE_DB_ID;
  if (!notion || !dbId) {
    warnMissingToken('おみくじメッセージ');
    return sampleOmikujiMessages;
  }

  const db = await notion.databases.retrieve({ database_id: dbId });
  if (!isFullDatabase(db) || db.data_sources.length === 0) {
    throw new Error(`Notionデータベース(${dbId})のデータソースを取得できませんでした。`);
  }

  const pages: PageObjectResponse[] = [];
  for await (const page of iteratePaginatedAPI(notion.dataSources.query, {
    data_source_id: db.data_sources[0].id,
  })) {
    if (isFullPage(page)) {
      pages.push(page);
    }
  }

  return pages.map(pageToOmikujiMessage);
}

function pageToOmikujiMessage(page: PageObjectResponse): OmikujiMessageItem {
  const props = page.properties;

  const fortune =
    props['運勢']?.type === 'title' ? richTextToPlain(props['運勢'].title) : '(無題)';

  let imageUrl: string | null = null;
  if (props['画像']?.type === 'files' && props['画像'].files.length > 0) {
    const file = props['画像'].files[0];
    imageUrl = file.type === 'external' ? file.external.url : imageProxyUrl('omikuji', page.id);
  }

  const message = richTextProp(props, 'メッセージ');

  return { id: page.id, fortune, imageUrl, message };
}

const sampleOmikujiMessages: OmikujiMessageItem[] = [
  {
    id: 'sample-omikuji-message-1',
    fortune: '大吉',
    imageUrl: null,
    message: '(サンプル) NOTION_OMIKUJI_MESSAGE_DB_ID を設定すると運勢ごとのメッセージが表示されます。',
  },
  {
    id: 'sample-omikuji-message-2',
    fortune: '中吉',
    imageUrl: null,
    message: '(サンプル) NOTION_OMIKUJI_MESSAGE_DB_ID を設定すると運勢ごとのメッセージが表示されます。',
  },
];
