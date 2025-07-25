import {
  GooglePhotoClient,
  GooglePhotoClientImpl,
} from "../gateway/GooglePhotoClient";

/**
 * 配列の差集合を計算する純粋関数
 * @param include 含める配列
 * @param exclude 除外する配列
 * @returns includeに含まれ、excludeに含まれない要素の配列
 */
const diff = (include: string[], exclude: string[]): string[] => {
  // パフォーマンスを向上させるためにSetを使用
  const excludeSet = new Set(exclude);
  return include.filter((id) => !excludeSet.has(id));
};

// 環境変数からGoogleフォトAPI認証情報を取得
const CLIENT_ID = process.env.GOOGLE_CLINET_ID ?? "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI ?? "";
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN ?? "";

// 環境変数から除外アルバムのデフォルト値を取得する関数（テスト時の動的な変更に対応）
const getDefaultExcludeAlbum = () => process.env.DEFAULT_EXCLUDE_ALBUM ?? "";

/**
 * アルバムAとアルバムBの差分を新規アルバムに追加する
 *
 * アルバムAに含まれる、かつアルバムBに含まれないメディアアイテムだけを新しいアルバムに追加します。
 * アルバムは毎回新規作成され、タイトルは「<アルバムA> - diff (<日付>)」の形式で自動生成されます。
 *
 * 使用方法:
 * ```
 * yarn makeDiffAlbum "<アルバムAのタイトル>" ["<アルバムBのタイトル>"]
 * ```
 *
 * 環境変数に以下の値を設定しておく必要があります:
 * - GOOGLE_CLINET_ID: Google Photo API クライアントID
 * - GOOGLE_CLIENT_SECRET: Google Photo API クライアントシークレット
 * - GOOGLE_REDIRECT_URI: Google Photo API リダイレクトURI
 * - GOOGLE_REFRESH_TOKEN: Google Photo API リフレッシュトークン
 * - DEFAULT_EXCLUDE_ALBUM (任意): アルバムBのデフォルト値
 */
export const makeDiffAlbum = async (
  titleA: string,
  titleB: string | undefined,
  clientInstance: GooglePhotoClient,
) => {
  try {
    // アルバムA（ソース）は必須
    if (!titleA) {
      throw new Error("Album A title is required");
    }

    // アルバムB（除外）は引数かデフォルト値から取得
    const finalTitleB = titleB || getDefaultExcludeAlbum();
    if (!finalTitleB) {
      throw new Error(
        "Album B title is required. Either provide it as an argument or set the DEFAULT_EXCLUDE_ALBUM environment variable.",
      );
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

    console.info("Starting makeDiffAlbum process");
    console.info(`Source album: "${titleA}"`);
    console.info(
      `Exclude album: "${finalTitleB}" ${
        titleB ? "" : "(from environment variable)"
      }`,
    );
    console.info(`Output album will be created as: "${outputTitle}"`);

    console.info("Resolving album IDs...");

    // アルバムID解決
    const albumIdA = await clientInstance.findAlbumIdByTitle(titleA);
    console.info(`Found album A: "${titleA}" (ID: ${albumIdA})`);

    const albumIdB = await clientInstance.findAlbumIdByTitle(finalTitleB);
    console.info(`Found album B: "${finalTitleB}" (ID: ${albumIdB})`);

    // メディアID一覧取得
    console.info(`Fetching media items from album A: "${titleA}"...`);
    const sourceIds = await clientInstance.fetchAllMediaIds(albumIdA);
    console.info(`Found ${sourceIds.length} media items in album A`);

    console.info(`Fetching media items from album B: "${finalTitleB}"...`);
    const excludeIds = await clientInstance.fetchAllMediaIds(albumIdB);
    console.info(`Found ${excludeIds.length} media items in album B`);

    // 差集合計算
    const addIds = diff(sourceIds, excludeIds);
    console.info(`Difference (A - B): ${addIds.length} items`);

    if (addIds.length === 0) {
      console.info(
        "No items to add. All items in album A are already in album B.",
      );
      return {
        sourceAlbum: titleA,
        excludeAlbum: finalTitleB,
        outputAlbum: outputTitle,
        sourceCount: sourceIds.length,
        excludeCount: excludeIds.length,
        addedCount: 0,
      };
    }

    // 新しいアルバムを作成
    console.info(`Creating new album: "${outputTitle}"`);
    const album = await clientInstance.createAlbum(outputTitle);
    const albumIdC = album.id;
    console.info(`Created album: "${outputTitle}" (ID: ${albumIdC})`);

    // batchAddMediaItems (50件ずつ)
    console.info(`Adding ${addIds.length} items to the new album...`);
    await clientInstance.batchAddMediaItems(addIds, albumIdC);

    // 統計出力
    console.info("----- Summary -----");
    console.info(`Source album: ${titleA} (${sourceIds.length} items)`);
    console.info(`Exclude album: ${finalTitleB} (${excludeIds.length} items)`);
    console.info(`Target album: ${outputTitle}`);
    console.info(`Items in difference set (A - B): ${addIds.length}`);
    console.info(`Total items added to new album: ${addIds.length}`);
    console.info("Process completed successfully");

    return {
      sourceAlbum: titleA,
      excludeAlbum: finalTitleB,
      outputAlbum: outputTitle,
      sourceCount: sourceIds.length,
      excludeCount: excludeIds.length,
      addedCount: addIds.length,
    };
  } catch (error) {
    console.error("Error executing makeDiffAlbum:", error);
    throw error;
  }
};

const main = async () => {
  const [titleA, titleBArg] = process.argv.slice(2);

  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI || !REFRESH_TOKEN) {
    console.error(
      "Required environment variables are not set. Please set GOOGLE_CLINET_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, and GOOGLE_REFRESH_TOKEN.",
    );
    process.exit(1);
  }

  const client = new GooglePhotoClientImpl({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    redirectUri: REDIRECT_URI,
    refreshToken: REFRESH_TOKEN,
  });

  try {
    await makeDiffAlbum(titleA, titleBArg, client);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
};

// 直接実行された場合のみmain関数を実行（他のファイルからインポートされた場合は実行しない）
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
