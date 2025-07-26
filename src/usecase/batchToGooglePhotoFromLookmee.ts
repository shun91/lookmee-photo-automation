import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 複数のgroupIdに対してtoGooglePhotoFromLookmeeを実行する
 *
 * 事前に環境変数に以下の値を設定しておく必要があります。
 * - LOOKMEE_TOKEN
 * - LOOKMEE_ORGANIZATION_ID
 * - GOOGLE_CLINET_ID
 * - GOOGLE_CLIENT_SECRET
 * - GOOGLE_REDIRECT_URI
 * - GOOGLE_REFRESH_TOKEN
 * - LOOKMEE_GROUP_IDS（任意）: カンマ区切りのgroupId（例: "1,2,3"）
 *
 * また、以下の値を標準入力から受け取ります。
 * - salesId: LookmeeのsalesId
 * - groupIds: カンマ区切りのgroupId（例: "1,2,3"）
 * - eventIds: LookmeeのeventId。カンマ区切りで複数指定可（任意：特定のイベントを指定する場合）
 * - uploadCount: アップロードする写真の枚数（任意）
 *
 * コマンドライン引数とLOOKMEE_GROUP_IDS環境変数の両方が指定された場合は、コマンドライン引数が優先されます。
 * どちらも指定されない場合はエラーになります。
 *
 * Usage:
 *   node src/usecase/batchToGooglePhotoFromLookmee.ts [salesId] [groupIds] [eventIds] [uploadCount]
 *
 * Example:
 *   node src/usecase/batchToGooglePhotoFromLookmee.ts 173128 1,2,3 6276436,6276437 10
 */
const main = async () => {
  // 標準入力からsalesIdとgroupIdsとeventIdsを受け取る
  const salesId = process.argv[2];
  // コマンドライン引数からgroupIdsを取得、なければ環境変数から取得
  const groupIdsArg = process.argv[3];
  const envGroupIds = process.env.LOOKMEE_GROUP_IDS;
  const groupIds = groupIdsArg
    ? groupIdsArg.split(",")
    : envGroupIds
      ? envGroupIds.split(",")
      : [];

  // eventIdsとuploadCountはそのまま渡す
  const eventIds = process.argv[4] || "";
  const uploadCount = process.argv[5];

  if (!salesId || groupIds.length === 0) {
    console.error(
      "Usage: node src/usecase/batchToGooglePhotoFromLookmee.ts [salesId] [groupIds] [eventIds] [uploadCount]",
    );
    console.error(
      "LOOKMEE_GROUP_IDS環境変数か引数でgroupIdsを指定する必要があります。",
    );
    process.exit(1);
  }

  console.info(`salesId: ${salesId}`);
  console.info(`groupIds: ${groupIds.join(", ")}`);
  console.info(`eventIds: ${eventIds}`);
  console.info(`uploadCount: ${uploadCount || "全て"}`);

  // 各groupIdに対してtoGooglePhotoFromLookmeeを実行
  for (const groupId of groupIds) {
    console.info(`\n-------- グループID: ${groupId}の処理を開始 --------`);

    const scriptPath = path.resolve(__dirname, "toGooglePhotoFromLookmee.ts");
    const args = [scriptPath, salesId, groupId];

    // eventIdsが指定されていれば追加
    if (eventIds) {
      args.push(eventIds);
    }

    // uploadCountが指定されていれば追加
    if (uploadCount) {
      args.push(uploadCount);
    }

    // tsx（またはts-node）でスクリプトを実行
    await new Promise((resolve, reject) => {
      const child = spawn("tsx", args, {
        stdio: "inherit",
        shell: true,
      });

      child.on("close", (code) => {
        if (code === 0) {
          console.info(`グループID: ${groupId}の処理が完了しました`);
          resolve(null);
        } else {
          console.error(
            `グループID: ${groupId}の処理が失敗しました（終了コード: ${code}）`,
          );
          reject(new Error(`Process exited with code ${code}`));
        }
      });
    }).catch((err) => {
      console.error(`エラーが発生しました: ${err.message}`);
    });
  }

  console.info("\n全てのグループの処理が完了しました");
};

main();
