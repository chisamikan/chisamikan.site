import { defineMiddleware } from 'astro:middleware';

// public/_headers のセキュリティヘッダーは静的ファイルにしか付かないため、
// Workerで返すAPI(/api/*)の応答にはここで付ける。APIはHTMLを返さないので、CSPは何も読み込ませない設定にする
const API_SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();
  if (context.isPrerendered) return response;
  // キャッシュから取り出した応答などはヘッダーを書き換えられないため、複製してから付ける
  const secured = new Response(response.body, response);
  for (const [name, value] of Object.entries(API_SECURITY_HEADERS)) {
    secured.headers.set(name, value);
  }
  return secured;
});
