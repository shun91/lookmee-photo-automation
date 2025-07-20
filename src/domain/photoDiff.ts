/**
 * 配列の差集合を計算する純粋関数
 * @param include 含める配列
 * @param exclude 除外する配列
 * @returns includeに含まれ、excludeに含まれない要素の配列
 */
export const diff = (include: string[], exclude: string[]): string[] => {
  // パフォーマンスを向上させるためにSetを使用
  const excludeSet = new Set(exclude);
  return include.filter((id) => !excludeSet.has(id));
};
