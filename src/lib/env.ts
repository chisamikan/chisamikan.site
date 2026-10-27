import { env as workerEnv } from 'cloudflare:workers';

/**
 * Cloudflareのランタイム環境(cloudflare:workers の env)から、シークレット・環境変数を読みます。
 * 本番はWorkerの「Variables and Secrets」、ローカル開発(astro dev)は .env の値が入ります。
 *
 * 注意: APIルートでは import.meta.env の秘密情報を参照しないこと。
 * ビルド時の値がWorkerのコード(とソースマップ)に平文で埋め込まれてしまうため、フォールバックも設けない。
 */
export function runtimeEnv(key: string): string | undefined {
  const value = (workerEnv as unknown as Record<string, unknown>)[key];
  return typeof value === 'string' && value ? value : undefined;
}
