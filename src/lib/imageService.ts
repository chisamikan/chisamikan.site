import sharp from 'astro/assets/services/sharp';
import type { LocalImageService } from 'astro';

// 変換済みの画像は、変換の指定から作ったハッシュで見分けて次のビルドで使い回す(node_modules/.astro)。
// 既定ではURL全体をハッシュに含めるが、Notionの画像URLは署名のクエリ文字列が1時間ほどで変わるため、
// 同じ画像でも毎回変換し直しになっていた。クエリを除いたURLで見分ける。
// Notionで画像を差し替えるとURLのパス(ファイルごとのID)が変わるため、古い変換結果が使われることはない
const service: LocalImageService = {
  ...sharp,
  async validateOptions(...args) {
    const validated = await sharp.validateOptions!(...args);
    const { src } = validated;
    return { ...validated, cacheKey: typeof src === 'string' ? src.split('?')[0] : src };
  },
  propertiesToHash: ['cacheKey', 'width', 'height', 'format', 'quality', 'fit', 'position', 'background'],
};

export default service;
