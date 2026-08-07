import type { APIContext } from 'astro';
import { env as workerEnv } from 'cloudflare:workers';

/**
 * Cloudflareのランタイム環境(cloudflare:workers の env)の値を優先し、
 * 無ければビルド時に静的展開された import.meta.env の値にフォールバックします。
 *
 * 注意: `import.meta.env[key]` のような動的プロパティアクセスはViteの静的置換の対象外で
 * 常に undefined になるため、buildTimeValue は呼び出し側で
 * `import.meta.env.NOTION_TOKEN` のように直接指定してもらう必要があります。
 *
 * `locals` は Astro.locals.runtime.env が廃止された名残の未使用引数です。
 */
export function pickEnv(
  _locals: APIContext['locals'],
  key: string,
  buildTimeValue: string | undefined
): string | undefined {
  return (workerEnv as Record<string, string | undefined>)[key] || buildTimeValue;
}
