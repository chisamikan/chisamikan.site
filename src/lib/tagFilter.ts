export function matchesTag(el: HTMLElement, filter: string): boolean {
  if (filter === 'all') return true;
  const tags = (el.dataset.tags ?? '').split('|').filter(Boolean);
  return tags.includes(filter);
}

// 絞り込み/ページ送りのたびに、既に一度表示済み(is-visible付与済み)の要素も含めて
// 毎回スタッガーアニメーションを再生し直す。参考実装(ics-creative)のリプレイボタンと
// 同じ手順で、まずtransitionを無効化してis-visibleを外し「隠れた」状態へ瞬時に巻き戻す→
// リフローで確定→次のフレームでtransitionを戻しつつis-visibleを再付与することで
// アニメーションを再発火させる(reflowを挟まないと、display:none→表示とopacity:0→1が
// 同フレームで処理され、ブラウザがトランジションを省略してしまう)。
export function revealItems(targets: HTMLElement[]): void {
  if (targets.length === 0) return;

  targets.forEach((el) => {
    el.style.transition = 'none';
    el.classList.remove('is-visible');
  });
  void targets[0].offsetHeight;

  requestAnimationFrame(() => {
    targets.forEach((el) => {
      el.style.transition = '';
      el.classList.add('is-visible');
    });
  });
}
