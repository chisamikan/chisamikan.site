import { handle } from '@astrojs/cloudflare/handler';
import { notifyNewNews } from './lib/newsNotify';

type ScheduledEnv = Env & { CF_DEPLOY_HOOK_URL?: string; DISCORD_NEWS_WEBHOOK_URL?: string };

/**
 * Workerのエントリポイント(wrangler.toml の main)。
 * 通常のリクエストはAstroに任せ、Cron Trigger(wrangler.toml の [triggers])の時だけ
 * - 毎時0分・30分: Deploy Hookを叩いて再ビルドさせます。Notion/RSSの内容はビルド時にしか取得されないためです。
 *   (GitHub Actionsのscheduleは数時間遅れることがあるため、Cloudflare側で定期実行しています)
 * - 毎時5分・35分: 再ビルド後の/rss.xmlに新着があれば、Discordのお知らせ用チャンネルへ通知します(src/lib/newsNotify.ts)。
 */
export default {
  fetch: handle,

  async scheduled(controller, env, ctx) {
    const { CF_DEPLOY_HOOK_URL: hookUrl, DISCORD_NEWS_WEBHOOK_URL: newsWebhookUrl } = env as ScheduledEnv;

    // wrangler.toml の [triggers] crons のうち、再ビルド用以外のものはお知らせの通知用
    if (controller.cron !== '*/30 * * * *') {
      // お知らせ用のWebhookは、お問い合わせ通知(DISCORD_WEBHOOK_URL)とは別のチャンネルに送るため分けている
      if (newsWebhookUrl) ctx.waitUntil(notifyNewNews(env.ASSETS, env.COUNTER_KV, newsWebhookUrl));
      return;
    }

    // Deploy Hook URLは誰でもビルドを起動できてしまうため、シークレットで渡す
    if (hookUrl) {
      ctx.waitUntil(
        fetch(hookUrl, { method: 'POST' }).then((res) => {
          // 失敗をダッシュボードのCronイベントに残すため例外にする
          if (!res.ok) throw new Error(`Deploy Hookの呼び出しに失敗しました(HTTP ${res.status})`);
        }),
      );
    } else {
      console.error('[scheduled] CF_DEPLOY_HOOK_URL が設定されていません');
    }
  },
} satisfies ExportedHandler<Env>;
