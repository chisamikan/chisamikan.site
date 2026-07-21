import { Client, isFullDatabase, isFullPage } from '@notionhq/client';
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
function imageProxyUrl(kind: 'gallery' | 'works' | 'profile', id: string): string {
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

// ---------------------------------------------------------------------------
// Notion API はデータベースを直接クエリする方式を廃止し、データベース配下の
// データソースをクエリする方式(dataSources.query)に変更された。
// そのためデータベースIDからまずデータソースIDを取得してからクエリする。
// ---------------------------------------------------------------------------
async function queryPublishedDatabase(dbId: string, sortProperty: string) {
  const db = await notion!.databases.retrieve({ database_id: dbId });
  if (!isFullDatabase(db) || db.data_sources.length === 0) {
    throw new Error(`Notionデータベース(${dbId})のデータソースを取得できませんでした。`);
  }

  return notion!.dataSources.query({
    data_source_id: db.data_sources[0].id,
    filter: { property: 'Published', checkbox: { equals: true } },
    sorts: [{ property: sortProperty, direction: 'descending' }],
  });
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

  const res = await queryPublishedDatabase(dbId, 'Date');

  return res.results.filter(isFullPage).map(pageToArtwork);
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

  const res = await queryPublishedDatabase(dbId, 'Period');

  return res.results.filter(isFullPage).map(pageToWork);
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
