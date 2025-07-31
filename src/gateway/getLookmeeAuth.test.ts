import { test, describe, beforeEach, afterEach } from "node:test";
import { strict as assert } from "node:assert";
import { getLookmeeAuth } from "./getLookmeeAuth";

// 環境変数を保存
const originalEnv = {
  LOOKMEE_TOKEN: process.env.LOOKMEE_TOKEN,
  LOOKMEE_ORGANIZATION_ID: process.env.LOOKMEE_ORGANIZATION_ID,
  LOOKMEE_EMAIL: process.env.LOOKMEE_EMAIL,
  LOOKMEE_PASSWORD: process.env.LOOKMEE_PASSWORD,
};

beforeEach(() => {
  // 各テスト前に環境変数をクリア
  delete process.env.LOOKMEE_TOKEN;
  delete process.env.LOOKMEE_ORGANIZATION_ID;
  delete process.env.LOOKMEE_EMAIL;
  delete process.env.LOOKMEE_PASSWORD;
});

afterEach(() => {
  // 各テスト後に環境変数を復元
  if (originalEnv.LOOKMEE_TOKEN)
    process.env.LOOKMEE_TOKEN = originalEnv.LOOKMEE_TOKEN;
  if (originalEnv.LOOKMEE_ORGANIZATION_ID)
    process.env.LOOKMEE_ORGANIZATION_ID = originalEnv.LOOKMEE_ORGANIZATION_ID;
  if (originalEnv.LOOKMEE_EMAIL)
    process.env.LOOKMEE_EMAIL = originalEnv.LOOKMEE_EMAIL;
  if (originalEnv.LOOKMEE_PASSWORD)
    process.env.LOOKMEE_PASSWORD = originalEnv.LOOKMEE_PASSWORD;
});

describe("getLookmeeAuth", () => {
  test("異常系: LOOKMEE_EMAIL が未設定の場合", async () => {
    // LOOKMEE_EMAIL のみ未設定
    process.env.LOOKMEE_PASSWORD = "test-password";
    process.env.LOOKMEE_ORGANIZATION_ID = "12345";

    await assert.rejects(
      async () => {
        await getLookmeeAuth();
      },
      {
        message:
          "環境変数 LOOKMEE_EMAIL または LOOKMEE_PASSWORD が設定されていません",
      },
    );
  });

  test("異常系: LOOKMEE_PASSWORD が未設定の場合", async () => {
    // LOOKMEE_PASSWORD のみ未設定
    process.env.LOOKMEE_EMAIL = "test@example.com";
    process.env.LOOKMEE_ORGANIZATION_ID = "12345";

    await assert.rejects(
      async () => {
        await getLookmeeAuth();
      },
      {
        message:
          "環境変数 LOOKMEE_EMAIL または LOOKMEE_PASSWORD が設定されていません",
      },
    );
  });

  test("異常系: LOOKMEE_ORGANIZATION_ID が未設定の場合", async () => {
    // LOOKMEE_ORGANIZATION_ID のみ未設定
    process.env.LOOKMEE_EMAIL = "test@example.com";
    process.env.LOOKMEE_PASSWORD = "test-password";

    await assert.rejects(
      async () => {
        await getLookmeeAuth();
      },
      {
        message: "環境変数 LOOKMEE_ORGANIZATION_ID が設定されていません",
      },
    );
  });

  test("異常系: すべての環境変数が未設定の場合", async () => {
    // 全ての環境変数が未設定
    await assert.rejects(
      async () => {
        await getLookmeeAuth();
      },
      {
        message:
          "環境変数 LOOKMEE_EMAIL または LOOKMEE_PASSWORD が設定されていません",
      },
    );
  });
});
