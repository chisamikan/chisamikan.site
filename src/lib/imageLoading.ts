// CardGrid/CardSlider共通: コンテナ内でまだ読み込みが終わっていない(かつ判定対象の)画像がある間、
// オーバーレイを表示して隠す。「判定対象かどうか」(画面内/スライダー内に見えているか)は
// グリッドとスライダーで軸(縦/横)が異なるため、呼び出し側から isPending として渡す。
export function watchImageLoading(
  overlay: HTMLElement,
  container: HTMLElement,
  isPending: (img: HTMLImageElement) => boolean,
): void {
  const pendingImages = Array.from(container.querySelectorAll<HTMLImageElement>('img')).filter(isPending);
  if (pendingImages.length === 0) return;

  overlay.classList.remove('opacity-0');
  overlay.setAttribute('aria-hidden', 'false');

  Promise.all(
    pendingImages.map(
      (img) =>
        new Promise<void>((resolve) => {
          img.addEventListener('load', () => resolve(), { once: true });
          img.addEventListener('error', () => resolve(), { once: true });
        }),
    ),
  ).then(() => {
    overlay.classList.add('opacity-0');
    overlay.setAttribute('aria-hidden', 'true');
  });
}
