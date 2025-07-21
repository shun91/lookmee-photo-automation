import { chromium } from "playwright";

/**
 * Lookmeeのセッションクッキーを取得するスクリプト
 */
async function getLookmeeCookie() {
  // ブラウザを起動
  const browser = await chromium.launch({
    headless: true,
  });

  try {
    // ブラウザコンテキストを作成
    const context = await browser.newContext();

    // 新しいページを開く
    const page = await context.newPage();

    // Lookmeeのログインページにアクセス
    await page.goto("https://photo.lookmee.jp/");

    console.log("ログインページにアクセスしました");

    // ログインフォームに入力
    await page.fill('input[type="email"]', process.env.LOOKMEE_EMAIL ?? "");
    await page.fill(
      'input[type="password"]',
      process.env.LOOKMEE_PASSWORD ?? "",
    );

    // ログインボタンをクリック
    await page.getByRole("button", { name: "ログイン" }).click();

    // ログイン後のリダイレクトを待つ
    await page.waitForNavigation();

    console.log("ログインに成功しました");

    // 指定されたページに移動
    await page.goto("https://photo.lookmee.jp/site/organizations/12118");

    // ページの読み込みを待つ
    await page.waitForLoadState("networkidle");

    // クッキーを取得
    const cookies = await context.cookies();
    const sessionCookie = cookies.find(
      (cookie) => cookie.name === "_lookmee_photo_session",
    );

    if (sessionCookie) {
      console.log("セッションクッキーを取得しました:");
      console.log(`_lookmee_photo_session=${sessionCookie.value}`);
    } else {
      console.error("セッションクッキーが見つかりませんでした");
    }
  } catch (error) {
    console.error("エラーが発生しました:", error);
  } finally {
    // ブラウザを閉じる
    await browser.close();
  }
}

// スクリプトを実行
getLookmeeCookie().catch(console.error);
