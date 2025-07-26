import { LookmeeClient, LookmeeClientImpl } from "../gateway/LookmeeClient";

// 環境変数から組織IDを取得
const getOrganizationId = () => Number(process.env.LOOKMEE_ORGANIZATION_ID);

export interface AddCartParams {
  organizationId: number;
  salesId: number;
  photoIds: number[];
}

export interface AddCartResult {
  salesId: number;
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
  const { organizationId, salesId, photoIds } = params;

  if (!organizationId || !salesId || !photoIds.length) {
    throw new Error("organizationId, salesId, and photoIds are required");
  }

  const results = await Promise.all(
    photoIds.map((photoId) =>
      clientInstance.addCart({
        organizationId,
        salesId,
        photoId,
      }),
    ),
  );

  return {
    salesId,
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
 * - salesId: LookmeeのsalesId
 * - photoIds: カートに追加する写真のID（カンマ区切り）
 *
 * Usage:
 *  node src/usecase/addCart.ts [salesId] [photoIds]
 *
 * Example:
 *   node src/usecase/addCart.ts 173128 1,2,3
 */
const main = async () => {
  // 標準入力からsalesIdとphotoIdを受け取る
  const salesId = Number(process.argv[2]);
  const photoIds = process.argv[3].split(",").map(Number);
  if (!salesId || !photoIds.length) {
    console.error("Usage: node src/usecase/addCart.ts [salesId] [photoIds]");
    process.exit(1);
  }

  const organizationId = getOrganizationId();
  if (!organizationId) {
    console.error("LOOKMEE_ORGANIZATION_ID environment variable is required");
    process.exit(1);
  }

  const lookmeeClient = new LookmeeClientImpl();
  try {
    const result = await addCart(
      { organizationId, salesId, photoIds },
      lookmeeClient,
    );
    console.info(result);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
};

// 直接実行された場合のみmain関数を実行（他のファイルからインポートされた場合は実行しない）
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
