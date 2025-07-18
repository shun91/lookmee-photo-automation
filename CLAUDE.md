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

#### Lookmeeのセッションクッキー取得

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

主に2つの機能を提供：

- Lookmee Photo から Google Photo へ写真をアップロード
- Lookmee Photo のカートに写真を追加

#### 4. 認証ヘルパー

- Google API のリフレッシュトークン取得
- Lookmee のセッションクッキー取得（Playwright使用）

### データフロー

1. **Lookmeeから写真を取得**：
   - LookmeeClient を使用してAPI経由で写真データを取得
   - organizationId、salesId、groupId、eventId などのパラメータで写真を特定

2. **Google Photoへのアップロード**：
   - GooglePhotoClient を使用して新しいアルバムを作成
   - バッチ処理（最大50枚/バッチ）で写真をアップロード

3. **Lookmeeのカートへ追加**：
   - 指定された写真IDを使用してカートへ追加
