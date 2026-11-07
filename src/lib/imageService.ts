import sharp from 'astro/assets/services/sharp';
import type { LocalImageService } from 'astro';

// 変換済みの画像は、変換の指定から作ったハッシュで見分けて次のビルドで使い回す(node_modules/.astro)。
// 既定ではURL全体をハッシュに含めるが、Notionの画像URLは署名のクエリ文字列が1時間ほどで変わるため、
// 同じ画像でも毎回変換し直しになっていた。クエリを除いたURLで見分ける。
// Notionで画像を差し替えるとURLのパス(ファイルごとのID)が変わるため、古い変換結果が使われることはない。
// 変換する配信元(astro.config.mjs の remotePatterns)は、どれもクエリで画像の中身が変わらない
const service: LocalImageService = {
  ...sharp,
  async validateOptions(...args) {
    const validated = await sharp.validateOptions!(...args);
    const { src } = validated;
    // 変換の設定(AVIFのeffortなど)を変えたときに、使い回さず変換し直すため設定も含める
    const cacheKey = [typeof src === 'string' ? src.split('?')[0] : src, args[1].service.config];
    return { ...validated, cacheKey };
  },
  // 既定では知らない指定をimgの属性としてHTMLへ書き出すため、cacheKeyを除く
  getHTMLAttributes({ cacheKey, ...options }, ...rest) {
    return sharp.getHTMLAttributes!(options, ...rest);
  },
  propertiesToHash: ['cacheKey', 'width', 'height', 'format', 'quality', 'fit', 'position', 'background'],
};

export default service;
