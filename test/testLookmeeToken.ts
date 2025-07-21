import { LookmeeClient } from "../src/gateway/LookmeeClient";

/**
 * LookmeeClientのトークン取得機能をテストするスクリプト
 *
 * テスト内容：
 * 1. 環境変数 LOOKMEE_TOKEN が設定されていない場合、クッキーからトークンを取得できるか
 * 2. 環境変数 LOOKMEE_TOKEN が設定されている場合、それが優先されるか
 * 3. トークンが一度取得されたら、キャッシュが使用されるか
 *
 * 使い方:
 *   ts-node src/usecase/testLookmeeToken.ts [mode]
 *
 * mode:
 *   - env: 環境変数 LOOKMEE_TOKEN を使用するテスト（設定されている必要あり）
 *   - cookie: クッキー取得によるテスト（LOOKMEE_EMAIL, LOOKMEE_PASSWORD が設定されている必要あり）
 *   - cache: キャッシュの確認テスト
 */
const main = async () => {
  const mode = process.argv[2] || "";

  if (!["env", "cookie", "cache"].includes(mode)) {
    console.error(
      "Usage: ts-node src/usecase/testLookmeeToken.ts [env|cookie|cache]",
    );
    process.exit(1);
  }

  console.log(`テストモード: ${mode}`);

  if (mode === "env") {
    // 環境変数 LOOKMEE_TOKEN が設定されている場合のテスト
    if (!process.env.LOOKMEE_TOKEN) {
      console.error("このテストには環境変数 LOOKMEE_TOKEN の設定が必要です");
      process.exit(1);
    }

    console.log("環境変数 LOOKMEE_TOKEN が設定されている場合のテスト開始");
    const client = new LookmeeClient();

    console.time("トークン取得時間");
    const token = await client.getTokenForTest();
    console.timeEnd("トークン取得時間");

    console.log(
      "取得したトークン (先頭10文字):",
      token.substring(0, 10) + "...",
    );
    console.log("環境変数のトークンが使用されたことを確認してください");
  } else if (mode === "cookie") {
    // 環境変数 LOOKMEE_TOKEN が設定されていない場合のテスト
    // 一時的に環境変数をクリア
    const originalToken = process.env.LOOKMEE_TOKEN;
    if (originalToken) {
      console.log(
        "このテストのために一時的に環境変数 LOOKMEE_TOKEN をクリアします",
      );
      delete process.env.LOOKMEE_TOKEN;
    }

    if (!process.env.LOOKMEE_EMAIL || !process.env.LOOKMEE_PASSWORD) {
      console.error(
        "このテストには環境変数 LOOKMEE_EMAIL と LOOKMEE_PASSWORD の設定が必要です",
      );
      process.exit(1);
    }

    console.log("クッキーからトークンを取得するテスト開始");
    const client = new LookmeeClient();

    console.time("トークン取得時間");
    const token = await client.getTokenForTest();
    console.timeEnd("トークン取得時間");

    console.log(
      "取得したトークン (先頭10文字):",
      token.substring(0, 10) + "...",
    );
    console.log("クッキーからトークンが取得されたことを確認してください");

    // 環境変数を元に戻す
    if (originalToken) {
      process.env.LOOKMEE_TOKEN = originalToken;
      console.log("環境変数 LOOKMEE_TOKEN を元に戻しました");
    }
  } else if (mode === "cache") {
    // キャッシュのテスト
    console.log("キャッシュ機能のテスト開始");
    const client = new LookmeeClient();

    console.log("1回目のトークン取得:");
    console.time("1回目トークン取得時間");
    const token1 = await client.getTokenForTest();
    console.timeEnd("1回目トークン取得時間");
    console.log("トークン (先頭10文字):", token1.substring(0, 10) + "...");

    console.log("\n2回目のトークン取得:");
    console.time("2回目トークン取得時間");
    const token2 = await client.getTokenForTest();
    console.timeEnd("2回目トークン取得時間");
    console.log("トークン (先頭10文字):", token2.substring(0, 10) + "...");

    console.log(
      "\n2回目のトークン取得が明らかに速ければ、キャッシュが機能しています",
    );
    console.log("両方のトークンが一致することを確認:", token1 === token2);
  }
};

main().catch(console.error);
