// カードに「NEW」バッジを表示する期間(日数)
export const NEW_BADGE_THRESHOLD_DAYS = 7;

// Notionのcreated_time(サイトへの追加日時)から、New表示すべきか判定する
export function isNewItem(createdTime: string): boolean {
  const elapsedMs = Date.now() - new Date(createdTime).getTime();
  return elapsedMs >= 0 && elapsedMs <= NEW_BADGE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
}
