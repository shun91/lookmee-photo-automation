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

### Lookmee のカートへの追加

addCart.ts を実行します。詳細はソースコード内の説明を確認してください。
