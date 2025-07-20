# lookmee-photo-automation

Lookmee Photo における写真の選択や購入を効率化するためのスクリプト。

## 事前準備

### Google Photo API にアクセスするための認証情報の取得

以下を参考にして、Google Photo API にアクセスするための認証情報を取得してください。  
[REST スタートガイド | Google Photos APIs](https://developers.google.com/photos/library/guides/get-started?hl=ja)

取得した認証情報は ↓ の環境変数にセットしてください。

```
GOOGLE_CLINET_ID
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

## できること

### Lookmee から Google Photo にアップロード

toGooglePhotoFromLookmee.ts を実行します。詳細はソースコード内の説明を確認してください。

```bash
# コマンド例: yarn toGooglePhotoFromLookmee [salesId] [groupId] [eventIds] [uploadCount]
yarn toGooglePhotoFromLookmee 173128 1 6276436,6276437 10
```

### Lookmee のカートへの追加

addCart.ts を実行します。詳細はソースコード内の説明を確認してください。

```bash
# コマンド例: yarn addCart [salesId] [photoIds]
yarn addCart 173128 1,2,3
```

### アルバム差分の作成

2つのGoogleフォトアルバムの差分を新しいアルバムに追加します。「アルバムAに含まれる、かつアルバムBに含まれないメディアアイテム」のみを対象とします。

```bash
# コマンド例: yarn makeDiffAlbum "アルバムAのタイトル" "アルバムBのタイトル"
yarn makeDiffAlbum "2024年度運動会写真" "購入済み写真"
```

※出力アルバムは毎回新規作成され、タイトルは「アルバムA - diff (日付 時刻)」の形式で自動生成されます。

#### makeDiffAlbumの特徴

- 毎回新しいアルバム作成：日時を含むタイトルで自動的に新規アルバムを作成
- 50件ずつのバッチ処理：APIの制限内で効率的に処理
- ページネーション完全対応：どんな枚数のアルバムでも対応
- アプリ作成アルバム対応：2025-04-01以降のGoogle APIスコープ変更に準拠
- エラーハンドリング：5xx/429エラーに対する自動リトライ機能

この機能を利用して、Lookmeeからアップロードした写真と既に購入した写真の差分を抽出し、未購入写真だけを表示するなどの使い方ができます。
