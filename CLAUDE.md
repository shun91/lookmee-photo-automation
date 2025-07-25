# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## コマンドとスクリプト

### 環境変数の設定

このリポジトリのスクリプトを実行するには、以下の環境変数を設定する必要があります：

#### Google Photo API 関連

```
GOOGLE_CLINET_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI
GOOGLE_REFRESH_TOKEN
```

#### Lookmee API 関連

```
LOOKMEE_TOKEN
LOOKMEE_ORGANIZATION_ID
LOOKMEE_EMAIL
LOOKMEE_PASSWORD
```

### 主要スクリプトの実行

#### Google Photo のリフレッシュトークン取得

```bash
ts-node src/usecase/genGoogleRefreshToken.ts
```

#### Lookmee のセッションクッキー取得

```bash
ts-node src/getLookmeeCookie.ts
```

#### Lookmee から Google Photo にアップロード

```bash
# コマンド例: ts-node src/usecase/toGooglePhotoFromLookmee.ts [salesId] [groupId] [eventIds] [uploadCount]
ts-node src/usecase/toGooglePhotoFromLookmee.ts 173128 1 6276436,6276437 10
npm run toGooglePhotoFromLookmee -- 173128 1 6276436,6276437 10
```

#### Lookmee のカートに写真を追加

```bash
# コマンド例: ts-node src/usecase/addCart.ts [salesId] [photoIds]
ts-node src/usecase/addCart.ts 173128 1,2,3
npm run addCart -- 173128 1,2,3
```

## コードアーキテクチャ

### ディレクトリ構造

```
src/
├── gateway/                  # APIクライアントの実装
│   ├── GooglePhotoClient.ts  # Google Photo API クライアント
│   ├── LookmeeClient.ts      # Lookmee API クライアント
│   └── fetchRetry.ts         # リトライ機能付きのフェッチユーティリティ
├── usecase/                  # ユースケース実装
│   ├── addCart.ts            # Lookmeeのカートに写真を追加
│   ├── genGoogleRefreshToken.ts  # GoogleのリフレッシュトークンXを生成
│   └── toGooglePhotoFromLookmee.ts  # LookmeeからGoogle Photoへ写真をコピー
└── getLookmeeCookie.ts       # PlaywrightでLookmeeのセッションクッキーを取得
```

### 主要コンポーネント

#### 1. LookmeeClient

Lookmee Photo API にアクセスするためのクライアント。

- 写真の一覧取得
- カートへの追加

#### 2. GooglePhotoClient

Google Photos API にアクセスするためのクライアント。

- アルバム作成
- 写真のアップロード

#### 3. ユースケース

主に 2 つの機能を提供：

- Lookmee Photo から Google Photo へ写真をアップロード
- Lookmee Photo のカートに写真を追加

#### 4. 認証ヘルパー

- Google API のリフレッシュトークン取得
- Lookmee のセッションクッキー取得（Playwright 使用）

### データフロー

1. **Lookmee から写真を取得**：

   - LookmeeClient を使用して API 経由で写真データを取得
   - organizationId、salesId、groupId、eventId などのパラメータで写真を特定

2. **Google Photo へのアップロード**：

   - GooglePhotoClient を使用して新しいアルバムを作成
   - バッチ処理（最大 50 枚/バッチ）で写真をアップロード

3. **Lookmee のカートへ追加**：
   - 指定された写真 ID を使用してカートへ追加

## テスト戦略とルール

**重要**：リファクタリングへの耐性を優先して、実装の詳細ではなく外部からのふるまいをテストする。

### テストフレームワーク

- **Node.js 組み込みテスト**: `node:test`、`node:assert`、`node:mock` を使用
- **実行方法**: `npm test`

### テストファイルの構造

```typescript
import { test, describe, beforeEach, afterEach, mock } from "node:test";
import { strict as assert } from "node:assert";
```

#### 推奨ディレクトリ構造

- テストファイルは実装ファイルと同じディレクトリに置く

### テストパターン

#### 1. 正常系テスト

- **命名**: `"正常系: [期待される動作の説明]"`
- **検証対象**: 戻り値、副作用（メソッド呼び出し）、状態変更
- **例**: `"正常系: アルバムAとアルバムBの差分を新しいアルバムに追加"`

#### 2. 異常系テスト

- **命名**: `"異常系: [エラー条件の説明]"`
- **検証対象**: エラーの発生、エラーメッセージ、副作用なし
- **使用関数**: `assert.rejects()` で Promise のエラーを検証

#### 3. 境界値テスト

- **検証対象**: 空配列、0 件、最大値、最小値
- **例**: `"差分が0の場合: 新しいアルバムを作成せずに終了"`

#### 4. 環境変数テスト

- **環境変数の管理**: `beforeEach`/`afterEach` で保存/復元
- **テスト実行時の環境変数操作**: `process.env.VARIABLE_NAME = "value"`

### モック戦略

#### 外部依存の完全モック化

```typescript
const mockClient = {
  findAlbumIdByTitle: async (title: string) => {
    /* モック実装 */
  },
  fetchAllMediaIds: async (albumId: string) => {
    /* モック実装 */
  },
  createAlbum: mockCreateAlbum,
  batchAddMediaItems: mockBatchAddMediaItems,
} satisfies GooglePhotoClient;
```

#### モック関数の作成

```typescript
const mockCreateAlbum = mock.fn(async () => ({ id: "new-album-id" }));
```

#### モック呼び出しの検証

```typescript
// 呼び出し回数の検証
assert.equal(mockCreateAlbum.mock.callCount(), 1);

// 引数の検証
const firstCall = mockBatchAddMediaItems.mock.calls[0];
assert.deepEqual(firstCall.arguments[0], ["photo1", "photo3"]);
```

### アサーション戦略

#### 戻り値の検証

```typescript
assert.equal(result.sourceAlbum, "Album A");
assert.equal(result.addedCount, 2);
assert.match(
  result.outputAlbum,
  /^Album A - diff \(\d{4}-\d{1,2}-\d{1,2} \d{1,2}-\d{1,2}\)$/,
);
```

#### エラーの検証

```typescript
await assert.rejects(
  async () => {
    await makeDiffAlbum("", "Album B", mockClient);
  },
  { message: "Album A title is required" },
);
```

### テストデータ設計

#### 独立性の確保

- 各テストは独立して実行可能
- テスト間でのデータ共有は避ける
- 予測可能な固定値を使用

#### テストデータの例

```typescript
const testData = {
  albumA: { id: "album-a-id", photos: ["photo1", "photo2", "photo3"] },
  albumB: { id: "album-b-id", photos: ["photo2"] },
  expected: { diff: ["photo1", "photo3"], count: 2 },
};
```

### 環境変数管理

#### テスト前後の環境変数保存・復元

```typescript
const originalEnv = process.env.DEFAULT_EXCLUDE_ALBUM;
beforeEach(() => {
  process.env.DEFAULT_EXCLUDE_ALBUM = originalEnv;
});
afterEach(() => {
  process.env.DEFAULT_EXCLUDE_ALBUM = originalEnv;
});
```

### テスト実行時の注意点

- 環境変数が正しく設定されているか確認
- 外部依存（API）の状態を考慮
- テストの並列実行への対応

### TDD（テスト駆動開発）の進め方

1. **Red**: 失敗するテストを書く
2. **Green**: テストを通す最小限のコードを書く
3. **Refactor**: コードを改善する（テストは維持）

#### t-wada さんの TDD アプローチ

- 小さな単位でのテスト作成
- 段階的な機能追加
- リファクタリングを重視
