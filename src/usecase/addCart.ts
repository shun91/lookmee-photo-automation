import { LookmeeClient } from "../gateway/LookmeeClient";

const organizationId = Number(process.env.LOOKMEE_ORGANIZATION_ID);

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

  const lookmeeClient = new LookmeeClient();
  const result = await Promise.all(
    photoIds.map((photoId) =>
      lookmeeClient.addCart({
        organizationId,
        salesId,
        photoId: photoId,
      }),
    ),
  );

  console.info(result);
};

main();
