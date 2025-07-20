import { google } from "googleapis";
import readline from "readline";

const CLIENT_ID = process.env.GOOGLE_CLINET_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

/**
 * Google Photo にアクセスするためのリフレッシュトークンを取得するスクリプト
 *
 * 事前に環境変数に以下の値を設定しておく必要があります。
 * - GOOGLE_CLINET_ID
 * - GOOGLE_CLIENT_SECRET
 * - GOOGLE_REDIRECT_URI
 *
 * Usage:
 *   node src/usecase/genGoogleRefreshToken.ts
 */
const main = async () => {
  const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI,
  );

  // スコープを設定（2025年4月1日のAPI変更に対応）
  const SCOPES = [
    "https://www.googleapis.com/auth/photoslibrary.appendonly",
    "https://www.googleapis.com/auth/photoslibrary.readonly.appcreateddata",
  ];

  // 認証URLを生成
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
  });

  // ユーザーに認証URLを開いてもらい、認証コードを取得
  console.log("以下のURLをブラウザで開いてください:");
  console.log(authUrl);
  console.log("\n手順:");
  console.log("1. ブラウザでURLを開く");
  console.log("2. Googleアカウントでログインする");
  console.log(
    "3. 「このアプリは Google で確認されていません」画面が表示されたら:",
  );
  console.log("   a. 左下の「詳細」をクリック");
  console.log(
    "   b. 「安全ではないページ」または「(アプリ名)に移動」をクリック",
  );
  console.log("4. アクセス許可を与える");
  console.log("5. リダイレクト後のURLから「code=」の後の値をコピーする");
  console.log(
    "   例: http://localhost:8080/?code=4/0AfJohXm...&scope=... の場合、",
  );
  console.log("      「4/0AfJohXm...」（&scopeの前まで）をコピー\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question("コピーした認証コードを貼り付けてください: ", (code) => {
    rl.close();

    // 認証コードを使用してアクセストークンを取得
    oauth2Client.getToken(code, (err, token) => {
      if (err || !token) {
        console.error("Error retrieving access token", err);
        return;
      }

      oauth2Client.setCredentials(token);
      console.log("Access token retrieved:", token);
    });
  });
};

main();
