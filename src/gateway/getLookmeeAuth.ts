import { chromium } from "playwright";

/**
 * Lookmeeの認証情報（セッションクッキーとsalesId）を取得する
 */
export interface LookmeeAuthResult {
  lookmeeToken: string;
  salesId: string;
}

/**
 * Lookmeeの認証情報（セッションクッキーとsalesId）を取得する
 *
 * 常に Playwright を使ってログインし、セッションクッキーと「さっそく見る」リンクからsalesIdを取得する
 * 環境変数 LOOKMEE_TOKEN が設定されていても、salesIdを取得するために必ずログインが必要
 *
 * @returns Lookmee APIトークンとsalesId
 */
export async function getLookmeeAuth(): Promise<LookmeeAuthResult> {
  console.log("LookmeeにログインしてセッションクッキーとsalesIdを取得します");

  const email = process.env.LOOKMEE_EMAIL;
  const password = process.env.LOOKMEE_PASSWORD;
  const organizationId = process.env.LOOKMEE_ORGANIZATION_ID;

  if (!email || !password) {
    throw new Error(
      "環境変数 LOOKMEE_EMAIL または LOOKMEE_PASSWORD が設定されていません",
    );
  }

  if (!organizationId) {
    throw new Error("環境変数 LOOKMEE_ORGANIZATION_ID が設定されていません");
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

    // ログイン後のページ読み込みを待つ
    await page.waitForLoadState("networkidle");

    console.log("ログインに成功しました");

    // organizationページに移動
    await page.goto(
      `https://photo.lookmee.jp/site/organizations/${organizationId}`,
    );
    // ページの読み込みを待つ
    await page.waitForLoadState("networkidle");

    // 「さっそく見る」リンクを取得し、そのhref属性からsalesIdを抽出
    const firstLinkElement = page
      .getByRole("link", { name: "さっそく見る" })
      .first();
    const href = await firstLinkElement.getAttribute("href");

    if (!href) {
      throw new Error("「さっそく見る」リンクのhref属性が取得できませんでした");
    }

    // URLの末尾のパスを抽出してsalesIdとする
    const pathSegments = href
      .split("/")
      .filter((segment) => segment.length > 0);
    const salesId = pathSegments[pathSegments.length - 1];

    if (!salesId) {
      throw new Error("URLからsalesIdを取得できませんでした");
    }

    // 環境変数にトークンが設定されていればそれを使用、なければセッションクッキーを取得
    const envToken = process.env.LOOKMEE_TOKEN;
    let lookmeeToken: string;

    if (envToken) {
      console.log("環境変数 LOOKMEE_TOKEN を使用します");
      lookmeeToken = envToken;
    } else {
      // クッキーを取得
      const cookies = await context.cookies();
      const sessionCookie = cookies.find(
        (cookie) => cookie.name === "_lookmee_photo_session",
      );

      if (!sessionCookie) {
        throw new Error("セッションクッキーが見つかりませんでした");
      }

      lookmeeToken = sessionCookie.value;
    }

    console.log("認証情報とsalesIdを取得しました");
    return {
      lookmeeToken,
      salesId,
    };
  } finally {
    // ブラウザを閉じる
    await browser.close();
  }
}
