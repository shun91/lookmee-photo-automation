## 1. 要件定義

| 項目     | 内容                                                                                                                                                                                                                                            |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 目的     | Google  フォト内に存在する「アルバム A に含まれる **かつ** アルバム B に含まれない」メディアアイテムだけを新しいアルバム C にまとめる。                                                                                                         |
| コマンド | `yarn makeDiffAlbum "<アルバムAのタイトル>" "<アルバムBのタイトル>" "<アルバムCのタイトル(任意)>"`<br>※アルバム C タイトルを省略した場合は `"<アルバムA> - diff"` という名前で新規作成／再利用する                                              |
| 入力     | ① CLI 引数にアルバムタイトル３つ（A, B, C）<br>② `.env` に既存と同じ Google 認証情報 (`GOOGLE_CLIENT_ID` など)                                                                                                                                  |
| 出力     | 成功時：コンソールに「新規追加 xx 枚」「スキップ yy 枚」などの統計を INFO 出力<br>失敗時：`console.error()` でメッセージ出力し非 0 終了                                                                                                         |
| 動作要件 | \* 50  件ごとのバッチで API 呼び出し<br>\* ページネーション完全対応<br>\* 冪等：同じコマンドを何回実行しても重複追加しない                                                                                                                      |
| ロギング | 既存コード同様 **console** 系のみ（`console.info / warn / error`）                                                                                                                                                                              |
| 非機能   | \* Google Photos Library API 呼び出し回数最少化<br>\* 429/5xx へは共通 `fetchRetry`（指数バックオフ）適用                                                                                                                                       |
| 制約     | \* 引数はタイトルのみ ― スクリプト側でアルバム ID を解決<br>\* API 制限により「アプリ作成アイテムのみ操作可」。2025‑04‑01 以降の scope 変更にも準拠すること([Google for Developers][1], [Google for Developers][2], [Google for Developers][3]) |

---

## 2. 詳細設計

### 2‑1. ディレクトリ／ファイル追加

```
src/
 ├─ gateway/
 │   └─ GooglePhotoClient.ts   ← 既存クラスを拡張
 ├─ usecase/
 │   └─ makeDiffAlbum.ts       ← ★今回のエントリーポイント
 └─ domain/
     └─ photoDiff.ts           ← 純粋関数群 (集合演算など)
```

#### makeDiffAlbum.ts（ユースケース層）

1. **引数解析**

   ```ts
   const [titleA, titleB, titleC] = process.argv.slice(2);
   ```

2. **GooglePhotoClient 初期化**（既存と同パラメータ）
3. **アルバム ID 解決**
   `client.findAlbumIdByTitle(title)` を呼び、見つからなければエラー終了。
4. **メディア ID 一覧取得**

   - `client.fetchAllMediaIds(albumId)` – `mediaItems:search` をページネーションしながら取得。

5. **差集合計算**
   `photoDiff.diff(sourceIds, excludeIds)` → 追加対象 ID 配列
6. **アルバム C 用意**

   - タイトル C が既存なら再利用・なければ `client.createAlbum(titleC)`。

7. **既存アイテムの重複チェック**

   - C の現行 mediaIds を取得し、(5) ‑ (既存) をさらに差し引く。

8. **batchAddMediaItems**（50 件ずつ）
9. 統計を INFO 出力し正常終了。

#### GooglePhotoClient 追記メソッド

| メソッド                           | 役割・API                                                                              |
| ---------------------------------- | -------------------------------------------------------------------------------------- |
| `listAlbums()`                     | `GET /v1/albums`（ページ付き）([Google for Developers][3])                             |
| `findAlbumIdByTitle(title)`        | タイトル完全一致で ID を返す                                                           |
| `fetchAllMediaIds(albumId)`        | `POST /v1/mediaItems:search`（albumId 指定）で全ページ取得([Google for Developers][2]) |
| `batchAddMediaItems(ids, albumId)` | `POST /v1/albums/{id}:batchAddMediaItems`（<=50 件/回）([Google for Developers][1])    |

TypeScript 型や `fetchRetry` 共通化は既存ファイルと同じ方針。アクセストークン再利用ロジックは現在の `getAccessToken()` を流用。

#### domain/photoDiff.ts

```ts
export const diff = (include: string[], exclude: string[]) =>
  include.filter((id) => !excludeSet.has(id));
```

ユニットテスト容易な純粋関数とする。

### 2‑2. シーケンス（概要）

```
CLI → GooglePhotoClient.listAlbums()      ┐
    → findAlbumIdByTitle(A/B/C)           │ ① ID 解決
    → mediaItems.search(albumA) (n pages) │ ② IDsA 収集
    → mediaItems.search(albumB)           │ ③ IDsB 収集
    → diff(IDsA, IDsB)                    │ ④ 差集合
    → mediaItems.search(albumC)           │ ⑤ 重複除外
    → albums.batchAddMediaItems()×m回     │ ⑥ 追加
```

### 2‑3. 例外設計

| 想定エラー       | ハンドリング                        |
| ---------------- | ----------------------------------- |
| アルバム未発見   | `console.error` + `process.exit(1)` |
| 既存 API 4xx/5xx | `fetchRetry` 自動再試行、最大 6 回  |
| 差集合＝ 0       | INFO「追加対象なし」で正常終了      |

---

## 3. Google Photos API 仕様（実装に必要な部分を厳選）

| Endpoint                      | 主用途                        | 主パラメータ / 制限                                                                 | 備考                                                                                                 |
| ----------------------------- | ----------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **albums.list**               | タイトル →ID 解決             | `pageSize<=50`・`nextPageToken`                                                     | 取得できるのは _自アプリ作成_ アルバムのみ（2025‑04‑01 変更）([Google for Developers][3])            |
| **mediaItems.search**         | アルバムに含まれる media 一覧 | Request body に `albumId` をセット、`pageSize<=100`                                 | `filters` と同時指定不可。ページングは `nextPageToken`([Google for Developers][2])                   |
| **albums.batchAddMediaItems** | 既存 media をアルバムへ追加   | Path: `albums/{albumId}:batchAddMediaItems`<br>Body: `mediaItemIds` 最大 50 要素/回 | 追加対象もアルバムも **自アプリ作成** である必要あり。空レスポンスが成功([Google for Developers][1]) |
| **albums.create**             | 差分アルバム作成              | Body: `{album:{title}}`                                                             | 既存アルバムがあるかは list で確認                                                                   |

### 認証・スコープ

| フロー       | 内容                                                                                                                                                           |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 認証         | 既存実装と同じ OAuth 2.0 「Installed App」+ Refresh Token                                                                                                      |
| 必須スコープ | `https://www.googleapis.com/auth/photoslibrary.edit.appcreateddata`（読み書き）<br>or `photoslibrary.readonly.appcreateddata`（読み取りのみ）                  |
| 重要変更     | 2025‑04‑01 以降は **“app‑created data”** しか操作できない。つまり Web UI 手動作成アルバムは対象外。テスト時に必ず API で新規作成したアルバムを使う必要がある。 |

### 代表的レスポンス（抜粋）

```jsonc
// mediaItems.search
{
  "mediaItems": [
    {"id": "AKxyz...", "filename": "IMG_0001.JPG", ...}
  ],
  "nextPageToken": "Cg0Y..."
}
```

---

## 4. 実装タスク & マイルストーン

**重要**：テストは nodejs 標準の test モジュールを使って実装する

| #   | タスク                                                                                                    | 担当 | 完了条件                                |
| --- | --------------------------------------------------------------------------------------------------------- | ---- | --------------------------------------- |
| 1   | `GooglePhotoClient` に **listAlbums / findAlbumIdByTitle / fetchAllMediaIds / batchAddMediaItems** を追加 | -    | TypeScript 単体テスト通過               |
| 2   | `domain/photoDiff.ts` 実装 & テスト                                                                       | -    | 差集合ロジックのテスト                  |
| 3   | `usecase/makeDiffAlbum.ts` 実装                                                                           | -    | `yarn makeDiffAlbum` で最小ケースが動く |
| 4   | `package.json` に script 追加<br>`` json `"makeDiffAlbum": "ts-node src/usecase/makeDiffAlbum.ts" ``      | -    | `yarn makeDiffAlbum ...` で起動         |
| 5   | README 更新（使い方追記）                                                                                 | -    | PR に記載                               |
| 6   | 動作確認：テスト用アルバムを API で作成し、写真を手動で重複配置しないケース／重複ありケースを検証         | -    | コンソール出力が要件どおり              |

---

### 参考情報まとめ

- **albums.batchAddMediaItems** 仕様・50  件制限・必要スコープ ([Google for Developers][1])
- **mediaItems.search** 仕様・ページサイズ 100・`nextPageToken` ([Google for Developers][2])
- **albums.list** 仕様・`excludeNonAppCreatedData`・2025‑04‑01 scope 変更 ([Google for Developers][3])

---

これらを実装すれば、CLI 一発で「アルバム A – アルバム B」の差分を常に最新状態で維持でき、Lookmee からアップロードした写真だけを抽出するワークフローが完成します。

[1]: https://developers.google.com/photos/library/reference/rest/v1/albums/batchAddMediaItems "Method: albums.batchAddMediaItems  |  Google Photos APIs  |  Google for Developers"
[2]: https://developers.google.com/photos/library/reference/rest/v1/mediaItems/search "Method: mediaItems.search  |  Google Photos APIs  |  Google for Developers"
[3]: https://developers.google.com/photos/library/reference/rest/v1/albums/list "Method: albums.list  |  Google Photos APIs  |  Google for Developers"
