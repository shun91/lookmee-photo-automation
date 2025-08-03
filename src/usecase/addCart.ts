import { LookmeeClient, LookmeeClientImpl } from "../gateway/LookmeeClient";

export interface AddCartParams {
  photoIds: number[];
}

export interface AddCartResult {
  salesId: number;
  organizationId: number;
  photoIds: number[];
  addedCount: number;
  results: any[];
}

/**
 * カートに写真を追加する
 *
 * @param params 追加パラメータ
 * @param clientInstance LookmeeClientのインスタンス
 * @returns 追加結果
 */
export const addCart = async (
  params: AddCartParams,
  clientInstance: LookmeeClient,
): Promise<AddCartResult> => {
  const { photoIds } = params;

  if (!photoIds.length) {
    throw new Error("photoIds are required");
  }

  const results = await clientInstance.addCart(photoIds);

  // 結果表示用にsalesIdとorganizationIdを取得
  const salesId = await clientInstance.getSalesId();
  const organizationId = await clientInstance.getOrganizationId();

  return {
    salesId,
    organizationId,
    photoIds,
    addedCount: results.length,
    results,
  };
};

/**
 * カートに写真を追加する
 *
 * 事前に環境変数に以下の値を設定しておく必要があります。
 * - LOOKMEE_ORGANIZATION_ID
 * - LOOKMEE_EMAIL と LOOKMEE_PASSWORD （LOOKMEE_TOKEN が未設定の場合）
 *
 * また、以下の値を標準入力から受け取ります。
 * - photoIds: カートに追加する写真のID（カンマ区切り）
 * - salesId（任意）: LookmeeのsalesId（未指定の場合は自動取得）
 *
 * Usage:
 *  node src/usecase/addCart.ts [photoIds] [salesId]
 *  node src/usecase/addCart.ts [photoIds]
 *
 * Example:
 *   node src/usecase/addCart.ts 1,2,3
 *   node src/usecase/addCart.ts 1,2,3 173128
 */
const main = async () => {
  // 第1引数: photoIds、第2引数: salesId（任意）
  const photoIdsArg = process.argv[2];
  const salesIdArg = process.argv[3];

  if (!photoIdsArg) {
    console.error("Usage: node src/usecase/addCart.ts [photoIds] [salesId]");
    console.error("Example: node src/usecase/addCart.ts 1,2,3");
    console.error("Example: node src/usecase/addCart.ts 1,2,3 173128");
    process.exit(1);
  }

  const photoIds = photoIdsArg.split(",").map(Number);
  const salesId = salesIdArg ? Number(salesIdArg) : undefined;

  if (!photoIds.length) {
    console.error("photoIds are required");
    process.exit(1);
  }

  const lookmeeClient = salesId
    ? new LookmeeClientImpl(undefined, salesId.toString())
    : new LookmeeClientImpl();
  try {
    const result = await addCart({ photoIds }, lookmeeClient);
    console.info(result);

    // カート画面のURLを表示
    console.info("\nカート画面を開いて購入を完了してください。");
    console.info(
      `https://photo.lookmee.jp/site/organizations/${result.organizationId}/sales_managements/${result.salesId}/cart`,
    );
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
};

// 直接実行された場合のみmain関数を実行（他のファイルからインポートされた場合は実行しない）
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
