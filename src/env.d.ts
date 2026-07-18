/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly NOTION_TOKEN: string;
  readonly NOTION_PROFILE_PAGE_ID: string;
  readonly NOTION_GALLERY_DB_ID: string;
  readonly NOTION_WORKS_DB_ID: string;
  readonly NOTION_CONTACT_DB_ID: string;
  readonly RSS_FEED_URL: string;
  readonly SITE_TITLE: string;
  readonly SITE_DESCRIPTION: string;
  readonly TURNSTILE_SITE_KEY: string;
  readonly TURNSTILE_SECRET_KEY: string;
  readonly DISCORD_WEBHOOK_URL: string;
  readonly ZAPIER_ADMIN_WEBHOOK_URL: string;
  readonly ZAPIER_AUTOREPLY_WEBHOOK_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;
declare namespace App {
  interface Locals extends Runtime {}
}
