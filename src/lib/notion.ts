import { Client, isFullPage, isFullBlock } from '@notionhq/client';
import type {
  PageObjectResponse,
  BlockObjectResponse,
} from '@notionhq/client/build/src/api-endpoints';

// ---------------------------------------------------------------------------
// Notionクライアント
// ビルド時(SSG)にコンテンツを取得するため、トークンが無い場合は
// エラーで止めずに空データを返し、ローカルでもUIの見た目を確認できるようにします。
// ---------------------------------------------------------------------------
const token = import.meta.env.NOTION_TOKEN;

export const notion = token ? new Client({ auth: token }) : null;

function warnMissingToken(context: string) {
  console.warn(
    `[notion] NOTION_TOKEN が設定されていないため "${context}" はダミーデータで表示します。`
  );
}

// --- 型定義 -----------------------------------------------------------------

export type ProfileBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'image'; url: string; caption: string }
  | { type: 'quote'; text: string }
  | { type: 'bulleted_list'; items: string[] }
  | { type: 'numbered_list'; items: string[] }
  | { type: 'divider' };

export interface ArtworkItem {
  id: string;
  title: string;
  imageUrl: string | null;
  tags: string[];
  description: string;
  date: string | null;
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

// --- プロフィール -------------------------------------------------------------

/**
 * 指定したNotionページのブロックを取得し、Astroで描画しやすい
 * シンプルな配列(ProfileBlock[])に変換します。
 */
export async function getProfileBlocks(): Promise<ProfileBlock[]> {
  const pageId = import.meta.env.NOTION_PROFILE_PAGE_ID;
  if (!notion || !pageId) {
    warnMissingToken('プロフィール');
    return [
      {
        type: 'heading',
        level: 2,
        text: '（サンプル）はじめまして、イラストレーターです。',
      },
      {
        type: 'paragraph',
        text: 'NOTION_TOKEN と NOTION_PROFILE_PAGE_ID を設定すると、Notionページの内容がここに表示されます。',
      },
    ];
  }

  const blocks: BlockObjectResponse[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion.blocks.children.list({
      block_id: pageId,
      start_cursor: cursor,
      page_size: 100,
    });
    for (const b of res.results) {
      if (isFullBlock(b)) blocks.push(b);
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return blocks.map(blockToProfileBlock).filter((b): b is ProfileBlock => b !== null);
}

function richTextToPlain(richText: { plain_text: string }[]): string {
  return richText.map((t) => t.plain_text).join('');
}

function blockToProfileBlock(block: BlockObjectResponse): ProfileBlock | null {
  switch (block.type) {
    case 'heading_1':
      return { type: 'heading', level: 1, text: richTextToPlain(block.heading_1.rich_text) };
    case 'heading_2':
      return { type: 'heading', level: 2, text: richTextToPlain(block.heading_2.rich_text) };
    case 'heading_3':
      return { type: 'heading', level: 3, text: richTextToPlain(block.heading_3.rich_text) };
    case 'paragraph':
      return { type: 'paragraph', text: richTextToPlain(block.paragraph.rich_text) };
    case 'quote':
      return { type: 'quote', text: richTextToPlain(block.quote.rich_text) };
    case 'divider':
      return { type: 'divider' };
    case 'image': {
      const img = block.image;
      const url = img.type === 'external' ? img.external.url : img.file.url;
      return { type: 'image', url, caption: richTextToPlain(img.caption ?? []) };
    }
    case 'bulleted_list_item':
      return { type: 'bulleted_list', items: [richTextToPlain(block.bulleted_list_item.rich_text)] };
    case 'numbered_list_item':
      return { type: 'numbered_list', items: [richTextToPlain(block.numbered_list_item.rich_text)] };
    default:
      return null;
  }
}

// --- ギャラリー ---------------------------------------------------------------

/**
 * ギャラリー用データベースを取得します。
 * Notion側のプロパティ名(想定):
 *   Name(title) / Image(files) / Tags(multi_select) / Description(rich_text) / Date(date) / Published(checkbox)
 */
export async function getGalleryItems(): Promise<ArtworkItem[]> {
  const dbId = import.meta.env.NOTION_GALLERY_DB_ID;
  if (!notion || !dbId) {
    warnMissingToken('ギャラリー');
    return sampleGallery;
  }

  const res = await notion.databases.query({
    database_id: dbId,
    filter: { property: 'Published', checkbox: { equals: true } },
    sorts: [{ property: 'Date', direction: 'descending' }],
  });

  return res.results.filter(isFullPage).map(pageToArtwork);
}

function pageToArtwork(page: PageObjectResponse): ArtworkItem {
  const props = page.properties;

  const title =
    props.Name?.type === 'title' ? richTextToPlain(props.Name.title) : '(無題)';

  let imageUrl: string | null = null;
  if (props.Image?.type === 'files' && props.Image.files.length > 0) {
    const file = props.Image.files[0];
    imageUrl = file.type === 'external' ? file.external.url : file.file.url;
  }

  const tags =
    props.Tags?.type === 'multi_select' ? props.Tags.multi_select.map((t) => t.name) : [];

  const description =
    props.Description?.type === 'rich_text' ? richTextToPlain(props.Description.rich_text) : '';

  const date = props.Date?.type === 'date' ? (props.Date.date?.start ?? null) : null;

  return { id: page.id, title, imageUrl, tags, description, date };
}

const sampleGallery: ArtworkItem[] = [
  {
    id: 'sample-1',
    title: '(サンプル) 朝の光',
    imageUrl: null,
    tags: ['キャラクター', '朝'],
    description: 'NOTION_GALLERY_DB_ID を設定するとNotionの作品がここに並びます。',
    date: '2026-01-01',
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

  const res = await notion.databases.query({
    database_id: dbId,
    filter: { property: 'Published', checkbox: { equals: true } },
    sorts: [{ property: 'Period', direction: 'descending' }],
  });

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
    imageUrl = file.type === 'external' ? file.external.url : file.file.url;
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
 */
export async function createContactEntry(payload: ContactPayload): Promise<void> {
  const dbId = import.meta.env.NOTION_CONTACT_DB_ID;
  if (!notion || !dbId) {
    throw new Error(
      'NOTION_TOKEN / NOTION_CONTACT_DB_ID が設定されていないため、お問い合わせを送信できません。'
    );
  }

  await notion.pages.create({
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
