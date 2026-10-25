import { handle } from '@astrojs/cloudflare/handler';

/**
 * Workerのエントリポイント(wrangler.toml の main)。
 * 通常のリクエストはAstroに任せ、Cron Trigger(wrangler.toml の [triggers])の時だけ
 * Deploy Hookを叩いて再ビルドさせます。Notion/RSSの内容はビルド時にしか取得されないためです。
 * (GitHub Actionsのscheduleは数時間遅れることがあるため、Cloudflare側で定期実行しています)
 */
export default {
  fetch: handle,

  async scheduled(_controller, env, ctx) {
    // Deploy Hook URLは誰でもビルドを起動できてしまうため、シークレットで渡す
    const hookUrl = (env as Env & { CF_DEPLOY_HOOK_URL?: string }).CF_DEPLOY_HOOK_URL;
    if (!hookUrl) {
      console.error('[scheduled] CF_DEPLOY_HOOK_URL が設定されていません');
      return;
    }
    ctx.waitUntil(
      fetch(hookUrl, { method: 'POST' }).then((res) => {
        // 失敗をダッシュボードのCronイベントに残すため例外にする
        if (!res.ok) throw new Error(`Deploy Hookの呼び出しに失敗しました(HTTP ${res.status})`);
      }),
    );
  },
} satisfies ExportedHandler<Env>;
