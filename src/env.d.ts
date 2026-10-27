/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly NOTION_TOKEN: string;
  readonly NOTION_GALLERY_DB_ID: string;
  readonly NOTION_NOVELS_DB_ID: string;
  readonly NOTION_WORKS_DB_ID: string;
  readonly NOTION_TOOLBOX_DB_ID: string;
  readonly NOTION_NEWS_DB_ID: string;
  readonly RSS_FEED_URL: string;
  readonly BOOTH_SHOP_URL: string;
  readonly TURNSTILE_SITE_KEY: string;
  // TURNSTILE_SECRET_KEY・DISCORD_WEBHOOK_URL・CONTACT_ADMIN_EMAIL・CONTACT_FALLBACK_EMAIL は
  // APIルートで実行時に読む(src/lib/env.ts の runtimeEnv)。import.meta.env から読むと
  // ビルド時の値がWorkerのコードに平文で埋め込まれるため、ここには定義しない
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;
declare namespace App {
  interface Locals extends Runtime {}
}
