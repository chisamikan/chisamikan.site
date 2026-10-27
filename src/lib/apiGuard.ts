// APIルート共通の、不正なリクエストを弾くための確認処理

/**
 * 同じIPアドレスからの短時間の連続アクセスを制限します(上限は wrangler.toml の [[ratelimits]])。
 * レート制限の仕組み自体が失敗した場合は、正規の利用を妨げないよう通過させます。
 */
export async function isRateLimited(limiter: RateLimit, ip: string | null, context: string): Promise<boolean> {
  try {
    const { success } = await limiter.limit({ key: ip ?? 'unknown' });
    return !success;
  } catch (err) {
    console.error(`[${context}] レート制限の確認に失敗しました:`, err);
    return false;
  }
}

/**
 * 他サイトのページから送信させる攻撃(CSRF)やスクリプトからの直接送信を防ぐため、
 * 自サイトのページからのリクエスト(Originヘッダーが自サイト)かを確認します。
 */
export function isSameOrigin(request: Request): boolean {
  return request.headers.get('Origin') === new URL(request.url).origin;
}
