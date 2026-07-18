import type { APIContext } from 'astro';

/**
 * Cloudflareのランタイム環境(Astro.locals.runtime.env)の値を優先し、
 * 無ければビルド時に静的展開された import.meta.env の値にフォールバックします。
 *
 * 注意: `import.meta.env[key]` のような動的プロパティアクセスは、Viteのビルド時
 * 静的置換の対象にならず常に undefined になるため、buildTimeValue は
 * 呼び出し側で `import.meta.env.NOTION_TOKEN` のように直接指定してもらう必要があります。
 */
export function pickEnv(
  locals: APIContext['locals'],
  key: string,
  buildTimeValue: string | undefined
): string | undefined {
  const runtimeEnv = (locals as { runtime?: { env?: Record<string, string> } })?.runtime?.env;
  return runtimeEnv?.[key] || buildTimeValue;
}
