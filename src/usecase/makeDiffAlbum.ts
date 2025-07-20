import { GooglePhotoClient } from "../gateway/GooglePhotoClient";
import { diff } from "../domain/photoDiff";

// 環境変数からGoogleフォトAPI認証情報を取得
const CLIENT_ID = process.env.GOOGLE_CLINET_ID ?? "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI ?? "";
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN ?? "";

/**
 * アルバムAとアルバムBの差分を新規アルバムに追加する
 *
 * アルバムAに含まれる、かつアルバムBに含まれないメディアアイテムだけを新しいアルバムに追加します。
 * アルバムは毎回新規作成され、タイトルは「<アルバムA> - diff (<日付>)」の形式で自動生成されます。
 *
 * 使用方法:
 * ```
 * yarn makeDiffAlbum "<アルバムAのタイトル>" "<アルバムBのタイトル>"
 * ```
 *
 * 環境変数に以下の値を設定しておく必要があります:
 * - GOOGLE_CLINET_ID
 * - GOOGLE_CLIENT_SECRET
 * - GOOGLE_REDIRECT_URI
 * - GOOGLE_REFRESH_TOKEN
 */
const main = async () => {
  try {
    // 引数解析
    const [titleA, titleB] = process.argv.slice(2);

    if (!titleA || !titleB) {
      console.error(
        'Usage: ts-node src/usecase/makeDiffAlbum.ts "<Album A title>" "<Album B title>"',
      );
      process.exit(1);
    }

    // 現在の日時を含むアルバム名を生成
    const now = new Date();
    const dateStr = now.toLocaleDateString("ja-JP").replace(/\//g, "-");
    const timeStr = now
      .toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
      })
      .replace(":", "-");
    const outputTitle = `${titleA} - diff (${dateStr} ${timeStr})`;

    // 必要な環境変数が設定されているかチェック
    if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI || !REFRESH_TOKEN) {
      console.error(
        "Required environment variables are not set. Please set GOOGLE_CLINET_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, and GOOGLE_REFRESH_TOKEN.",
      );
      process.exit(1);
    }

    console.info("Starting makeDiffAlbum process");
    console.info(`Source album: "${titleA}"`);
    console.info(`Exclude album: "${titleB}"`);
    console.info(`Output album will be created as: "${outputTitle}"`);

    // GooglePhotoClient 初期化
    const client = new GooglePhotoClient({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      redirectUri: REDIRECT_URI,
      refreshToken: REFRESH_TOKEN,
    });

    console.info("Resolving album IDs...");

    // アルバムID解決
    const albumIdA = await client.findAlbumIdByTitle(titleA);
    console.info(`Found album A: "${titleA}" (ID: ${albumIdA})`);

    const albumIdB = await client.findAlbumIdByTitle(titleB);
    console.info(`Found album B: "${titleB}" (ID: ${albumIdB})`);

    // メディアID一覧取得
    console.info(`Fetching media items from album A: "${titleA}"...`);
    const sourceIds = await client.fetchAllMediaIds(albumIdA);
    console.info(`Found ${sourceIds.length} media items in album A`);

    console.info(`Fetching media items from album B: "${titleB}"...`);
    const excludeIds = await client.fetchAllMediaIds(albumIdB);
    console.info(`Found ${excludeIds.length} media items in album B`);

    // 差集合計算
    const addIds = diff(sourceIds, excludeIds);
    console.info(`Difference (A - B): ${addIds.length} items`);

    if (addIds.length === 0) {
      console.info(
        "No items to add. All items in album A are already in album B.",
      );
      process.exit(0);
    }

    // 新しいアルバムを作成
    console.info(`Creating new album: "${outputTitle}"`);
    const album = await client.createAlbum(outputTitle);
    const albumIdC = album.id;
    console.info(`Created album: "${outputTitle}" (ID: ${albumIdC})`);

    // batchAddMediaItems (50件ずつ)
    console.info(`Adding ${addIds.length} items to the new album...`);
    await client.batchAddMediaItems(addIds, albumIdC);

    // 統計出力
    console.info("----- Summary -----");
    console.info(`Source album: ${titleA} (${sourceIds.length} items)`);
    console.info(`Exclude album: ${titleB} (${excludeIds.length} items)`);
    console.info(`Target album: ${outputTitle}`);
    console.info(`Items in difference set (A - B): ${addIds.length}`);
    console.info(`Total items added to new album: ${addIds.length}`);
    console.info("Process completed successfully");
  } catch (error) {
    console.error("Error executing makeDiffAlbum:", error);
    process.exit(1);
  }
};

main();
