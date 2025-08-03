import { LookmeeClient, LookmeeClientImpl } from "../gateway/LookmeeClient";
import {
  GooglePhotoClient,
  GooglePhotoClientImpl,
} from "../gateway/GooglePhotoClient";

const CLIENT_ID = process.env.GOOGLE_CLINET_ID ?? "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI ?? "";
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN ?? "";

/**
 * Lookmee API から写真を取得し、Google Photo にアップロードする
 *
 * @param salesId LookmeeのsalesId（任意：未指定の場合は自動取得）
 * @param groupId LookmeeのgroupId
 * @param eventIds LookmeeのeventId。カンマ区切りで複数指定可（任意：特定のイベントを指定する場合）
 * @param uploadCount アップロードする写真の枚数（任意）
 * @param googlePhotoClient Google Photo APIクライアント
 * @param lookmeeClient Lookmee APIクライアント
 */
export const toGooglePhotoFromLookmee = async (
  salesId: number | undefined,
  groupId: number,
  eventIds: (number | undefined)[],
  uploadCount: string,
  googlePhotoClient: GooglePhotoClient,
  lookmeeClient: LookmeeClient,
) => {
  // 入力値の検証
  if (!groupId) {
    throw new Error("groupId is required");
  }

  // すべての写真を取得
  const promises = eventIds.map((eventId) => {
    return lookmeeClient.fetchAllPhotos({
      groupId,
      eventId,
    });
  });
  const photos = (await Promise.all(promises)).flat();
  console.info(`Found ${photos.length} photos`);

  // アルバム作成（lookmee-{yyyymm}-{groupId}の形式で作成）
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  const yyyymm = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}`;
  const albumName = `lookmee-${yyyymm}-${groupId}`;
  const { id } = await googlePhotoClient.createAlbum(albumName);

  // アップロード
  const targetPhotos = photos.slice(
    0,
    uploadCount !== undefined && uploadCount !== ""
      ? Number(uploadCount)
      : photos.length,
  );
  await googlePhotoClient.batchCreateAll(targetPhotos, id);

  return {
    albumName,
    albumId: id,
    totalPhotos: photos.length,
    uploadedPhotos: targetPhotos.length,
  };
};

/**
 * Lookmee API から写真を取得し、Google Photo にアップロードする
 *
 * 事前に環境変数に以下の値を設定しておく必要があります。
 * - LOOKMEE_ORGANIZATION_ID
 * - LOOKMEE_EMAIL と LOOKMEE_PASSWORD （LOOKMEE_TOKEN が未設定の場合）
 * - GOOGLE_CLINET_ID
 * - GOOGLE_CLIENT_SECRET
 * - GOOGLE_REDIRECT_URI
 * - GOOGLE_REFRESH_TOKEN
 *
 * また、以下の値を標準入力から受け取ります。
 * - groupId: LookmeeのgroupId
 * - eventIds: LookmeeのeventId。カンマ区切りで複数指定可（任意：特定のイベントを指定する場合）
 * - uploadCount: アップロードする写真の枚数（任意）
 * - salesId（任意）: LookmeeのsalesId（未指定の場合は自動取得）
 *
 * groupIdは、Lookmee Photoの画面をブラウザで開き、アドレスバーから取得できます。
 *
 * Usage:
 *   node src/usecase/toGooglePhotoFromLookmee.ts [groupId] [eventIds] [uploadCount] [salesId]
 *   node src/usecase/toGooglePhotoFromLookmee.ts [groupId] [eventIds] [uploadCount]
 *   node src/usecase/toGooglePhotoFromLookmee.ts [groupId]
 *
 * Example:
 *   node src/usecase/toGooglePhotoFromLookmee.ts 1 6276436,6276437 10
 *   node src/usecase/toGooglePhotoFromLookmee.ts 1 6276436,6276437 10 173128
 */
const main = async () => {
  // 標準入力からgroupId、eventIds、uploadCount、salesIdを受け取る
  const groupId = Number(process.argv[2]);
  const eventIds = process.argv[3]
    ? process.argv[3].split(",").map(Number)
    : [undefined];
  const uploadCount = process.argv[4];
  const salesId = process.argv[5] ? Number(process.argv[5]) : undefined;

  if (!groupId) {
    console.error(
      "Usage: node src/usecase/toGooglePhotoFromLookmee.ts [groupId] [eventIds] [uploadCount] [salesId]",
    );
    console.error(
      "Example: node src/usecase/toGooglePhotoFromLookmee.ts 1 6276436,6276437 10",
    );
    console.error(
      "Example: node src/usecase/toGooglePhotoFromLookmee.ts 1 6276436,6276437 10 173128",
    );
    process.exit(1);
  }

  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI || !REFRESH_TOKEN) {
    console.error(
      "Required environment variables are not set. Please set GOOGLE_CLINET_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, and GOOGLE_REFRESH_TOKEN.",
    );
    process.exit(1);
  }

  // Google Photo にアップロード
  const googlePhotoClient = new GooglePhotoClientImpl({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    redirectUri: REDIRECT_URI,
    refreshToken: REFRESH_TOKEN,
  });

  const lookmeeClient = salesId
    ? new LookmeeClientImpl(undefined, salesId.toString())
    : new LookmeeClientImpl();

  try {
    await toGooglePhotoFromLookmee(
      salesId,
      groupId,
      eventIds,
      uploadCount,
      googlePhotoClient,
      lookmeeClient,
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
