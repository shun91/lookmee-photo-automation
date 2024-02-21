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
    REDIRECT_URI
  );

  // スコープを設定（必要に応じて変更）
  const SCOPES = ["https://www.googleapis.com/auth/photoslibrary"];

  // 認証URLを生成
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
  });

  // ユーザーに認証URLを開いてもらい、認証コードを取得
  console.log("Authorize this app by visiting this url:", authUrl);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question("URL中のcodeパラメータの値を入力してください: ", (code) => {
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
