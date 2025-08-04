# lookmee-photo-automation

Lookmee Photo における写真の選択や購入を効率化するためのスクリプト。

## 事前準備

### Google Photo API にアクセスするための認証情報の取得

以下を参考にして、Google Photo API にアクセスするための認証情報を取得してください。  
[REST スタートガイド | Google Photos APIs](https://developers.google.com/photos/library/guides/get-started?hl=ja)

取得した認証情報は ↓ の環境変数にセットしてください。

```
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI
```

上記の認証情報を使い、Refresh Token を作成します。  
このために genGoogleRefreshToken.ts を実行します。詳細はソースコード内の説明を確認してください。  
取得した認証情報は ↓ の環境変数にセットしてください。

```
GOOGLE_REFRESH_TOKEN
```

### Lookmee API にアクセスするための認証情報の取得

1. Lookmee Photo の画面をブラウザで開く
2. chrome developer tools のネットワークタブを開く
3. Lookmee API へのリクエストに付与されている cookie の `_lookmee_photo_session` の値を取得する
4. 取得した値を ↓ の環境変数にセットする

```
LOOKMEE_TOKEN
```

また、保育園の ID も取得が必要です。  
Lookmee Photo の画面をブラウザで開き、アドレスバーから取得できます。取得したら ↓ の環境変数にセットしてください。

```
LOOKMEE_ORGANIZATION_ID
```

### makeDiffAlbum のための設定（オプション）

差分作成機能（makeDiffAlbum）でよく使用する除外アルバム（アルバム B）を環境変数に設定しておくことで、コマンドライン引数の入力を省略できます。

```
DEFAULT_EXCLUDE_ALBUM="購入済み写真"
```

この環境変数を設定すると、コマンド実行時にアルバム B の指定を省略できます：

```bash
# アルバムBを環境変数から取得
yarn makeDiffAlbum "2024年度運動会写真"
```

## できること

### Lookmee から Google Photo にアップロード

toGooglePhotoFromLookmee.ts を実行します。詳細はソースコード内の説明を確認してください。

```bash
# コマンド例: yarn toGooglePhotoFromLookmee [groupId] [eventIds] [uploadCount] [salesId]
yarn toGooglePhotoFromLookmee 1 6276436,6276437 10
yarn toGooglePhotoFromLookmee 1 6276436,6276437 10 173128
```

### Lookmee から Google Photo に一括アップロード

複数のイベントを一括でアップロードできます。

```bash
# コマンド例: yarn batchToGooglePhotoFromLookmee
yarn batchToGooglePhotoFromLookmee
```

### Lookmee のカートへの追加

addCart.ts を実行します。詳細はソースコード内の説明を確認してください。

```bash
# コマンド例: yarn addCart [photoIds] [salesId]
yarn addCart 1,2,3
yarn addCart 1,2,3 173128
```

### アルバム差分の作成

2 つの Google フォトアルバムの差分を新しいアルバムに追加します。「アルバム A に含まれる、かつアルバム B に含まれないメディアアイテム」のみを対象とします。

```bash
# コマンド例: yarn makeDiffAlbum "アルバムAのタイトル" ["アルバムBのタイトル"]
yarn makeDiffAlbum "2024年度運動会写真" "購入済み写真"

# アルバムBを環境変数から取得する場合（DEFAULT_EXCLUDE_ALBUMを設定している場合）
yarn makeDiffAlbum "2024年度運動会写真"
```

※出力アルバムは毎回新規作成され、タイトルは「アルバム A - diff (日付 時刻)」の形式で自動生成されます。

#### makeDiffAlbum の特徴

- 毎回新しいアルバム作成：日時を含むタイトルで自動的に新規アルバムを作成
- 除外アルバム（アルバム B）の環境変数設定：よく使うアルバムを環境変数に設定可能
- インメモリキャッシュ：アルバム一覧を 60 秒間キャッシュし、パフォーマンス向上
- 50 件ずつのバッチ処理：API の制限内で効率的に処理
- ページネーション完全対応：どんな枚数のアルバムでも対応
- アプリ作成アルバム対応：2025-04-01 以降の Google API スコープ変更に準拠
- エラーハンドリング：5xx/429 エラーに対する自動リトライ機能

この機能を利用して、Lookmee からアップロードした写真と既に購入した写真の差分を抽出し、未購入写真だけを表示するなどの使い方ができます。
