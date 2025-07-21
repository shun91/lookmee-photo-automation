import { chromium } from "playwright";

/**
 * Lookmeeのセッションクッキーを取得する
 *
 * 環境変数 LOOKMEE_TOKEN が設定されていればそれを返す
 * 未設定の場合は Playwright を使ってログインし、セッションクッキーを取得する
 *
 * @returns Lookmee APIトークン
 */
export async function getLookmeeToken(): Promise<string> {
  // 環境変数からトークンを取得できる場合はそれを返す
  const envToken = process.env.LOOKMEE_TOKEN;
  if (envToken) {
    console.log("環境変数 LOOKMEE_TOKEN からトークンを取得しました");
    return envToken;
  }

  // 環境変数が未設定の場合はPlaywrightでログインしてクッキーを取得
  console.log("Lookmeeにログインしてセッションクッキーを取得します");
  const email = process.env.LOOKMEE_EMAIL;
  const password = process.env.LOOKMEE_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "環境変数 LOOKMEE_EMAIL または LOOKMEE_PASSWORD が設定されていません",
    );
  }

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
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);

    // ログインボタンをクリック
    await page.getByRole("button", { name: "ログイン" }).click();

    // ログイン後のリダイレクトを待つ
    await page.waitForNavigation();

    console.log("ログインに成功しました");

    // organizationIdがある場合は指定のページに移動
    const organizationId = process.env.LOOKMEE_ORGANIZATION_ID;
    if (organizationId) {
      await page.goto(
        `https://photo.lookmee.jp/site/organizations/${organizationId}`,
      );
      // ページの読み込みを待つ
      await page.waitForLoadState("networkidle");
    }

    // クッキーを取得
    const cookies = await context.cookies();
    const sessionCookie = cookies.find(
      (cookie) => cookie.name === "_lookmee_photo_session",
    );

    if (!sessionCookie) {
      throw new Error("セッションクッキーが見つかりませんでした");
    }

    console.log("セッションクッキーを取得しました");
    return sessionCookie.value;
  } finally {
    // ブラウザを閉じる
    await browser.close();
  }
}
