import { test, describe, beforeEach, afterEach, mock } from "node:test";
import { strict as assert } from "node:assert";
import { GooglePhotoClient } from "../gateway/GooglePhotoClient";
import { makeDiffAlbum } from "./makeDiffAlbum";

const originalEnv = process.env.DEFAULT_EXCLUDE_ALBUM;
beforeEach(() => {
  process.env.DEFAULT_EXCLUDE_ALBUM = originalEnv;
});
afterEach(() => {
  process.env.DEFAULT_EXCLUDE_ALBUM = originalEnv;
});

describe("makeDiffAlbum", () => {
  test("正常系: アルバムAとアルバムBの差分を新しいアルバムに追加", async () => {
    const mockCreateAlbum = mock.fn(async () => ({
      id: "new-album-id",
    }));
    const mockBatchAddMediaItems = mock.fn(
      async (_mediaIds: string[], _albumId: string) => {},
    );
    const mockBatchCreateAll = mock.fn(async () => {});
    const mockClient = {
      findAlbumIdByTitle: async (title: string) => {
        if (title === "Album A") return "album-a-id";
        if (title === "Album B") return "album-b-id";
        throw new Error(`Album not found with title: ${title}`);
      },
      fetchAllMediaIds: async (albumId: string) => {
        if (albumId === "album-a-id") return ["photo1", "photo2", "photo3"];
        if (albumId === "album-b-id") return ["photo2"];
        throw new Error(`Album not found with id: ${albumId}`);
      },
      createAlbum: mockCreateAlbum,
      batchAddMediaItems: mockBatchAddMediaItems,
      batchCreateAll: mockBatchCreateAll,
    } satisfies GooglePhotoClient;

    const result = await makeDiffAlbum("Album A", "Album B", mockClient);

    // 結果の検証
    assert.equal(result.sourceAlbum, "Album A");
    assert.equal(result.excludeAlbum, "Album B");
    assert.equal(result.sourceCount, 3);
    assert.equal(result.excludeCount, 1);
    assert.equal(result.addedCount, 2);
    assert.match(
      result.outputAlbum,
      /^Album A - diff \(\d{4}-\d{1,2}-\d{1,2} \d{1,2}-\d{1,2}\)$/,
    );

    // メソッド呼び出しの検証
    assert.equal(mockCreateAlbum.mock.callCount(), 1);
    assert.equal(mockBatchAddMediaItems.mock.callCount(), 1);

    // batchAddMediaItemsが正しい引数で呼び出されたことを確認
    assert.ok(mockBatchAddMediaItems.mock.calls.length > 0);
    const firstCall = mockBatchAddMediaItems.mock.calls[0];
    assert.ok(firstCall);
    assert.ok(firstCall.arguments);
    assert.ok(firstCall.arguments.length >= 2);
    assert.deepEqual(firstCall.arguments[0], ["photo1", "photo3"]); // 差分のメディアID
    assert.equal(firstCall.arguments[1], "new-album-id"); // 新しいアルバムID
  });

  test("差分が0の場合: 新しいアルバムを作成せずに終了", async () => {
    const mockCreateAlbum = mock.fn(async () => ({ id: "new-album-id" }));
    const mockBatchAddMediaItems = mock.fn(
      async (_mediaIds: string[], _albumId: string) => {},
    );
    const mockBatchCreateAll = mock.fn(async () => {});
    const mockClient = {
      findAlbumIdByTitle: async (title: string) => {
        if (title === "Album A") return "album-a-id";
        if (title === "Album B") return "album-b-id";
        throw new Error(`Album not found with title: ${title}`);
      },
      fetchAllMediaIds: async (albumId: string) => {
        if (albumId === "album-a-id") return ["photo1", "photo2"];
        if (albumId === "album-b-id") return ["photo1", "photo2"];
        throw new Error(`Album not found with id: ${albumId}`);
      },
      createAlbum: mockCreateAlbum,
      batchAddMediaItems: mockBatchAddMediaItems,
      batchCreateAll: mockBatchCreateAll,
    } satisfies GooglePhotoClient;

    const result = await makeDiffAlbum("Album A", "Album B", mockClient);

    // 結果の検証
    assert.equal(result.sourceAlbum, "Album A");
    assert.equal(result.excludeAlbum, "Album B");
    assert.equal(result.sourceCount, 2);
    assert.equal(result.excludeCount, 2);
    assert.equal(result.addedCount, 0);

    // メソッド呼び出しの検証
    assert.equal(mockCreateAlbum.mock.callCount(), 0);
    assert.equal(mockBatchAddMediaItems.mock.callCount(), 0);
  });

  test("異常系: アルバムAのタイトルが空の場合", async () => {
    const mockClient = {} as GooglePhotoClient;

    await assert.rejects(
      async () => {
        await makeDiffAlbum("", "Album B", mockClient);
      },
      {
        message: "Album A title is required",
      },
    );
  });

  test("異常系: アルバムBのタイトルが空でデフォルトアルバムも設定されていない場合", async () => {
    delete process.env.DEFAULT_EXCLUDE_ALBUM;

    const mockClient = {
      findAlbumIdByTitle: async () => "album-id",
      fetchAllMediaIds: async () => [],
      createAlbum: async () => ({ id: "new-album-id" }),
      batchAddMediaItems: async () => {},
      batchCreateAll: async () => {},
    } satisfies GooglePhotoClient;

    await assert.rejects(
      async () => {
        await makeDiffAlbum("Album A", undefined, mockClient);
      },
      {
        message:
          "Album B title is required. Either provide it as an argument or set the DEFAULT_EXCLUDE_ALBUM environment variable.",
      },
    );
  });

  test("環境変数のDEFAULT_EXCLUDE_ALBUMを使用する場合", async () => {
    process.env.DEFAULT_EXCLUDE_ALBUM = "Default Album";

    const mockCreateAlbum = mock.fn(async () => ({ id: "new-album-id" }));
    const mockBatchAddMediaItems = mock.fn(
      async (_mediaIds: string[], _albumId: string) => {},
    );
    const mockBatchCreateAll = mock.fn(async () => {});
    const mockClient = {
      findAlbumIdByTitle: async (title: string) => {
        if (title === "Album A") return "album-a-id";
        if (title === "Default Album") return "default-album-id";
        throw new Error("Album not found");
      },
      fetchAllMediaIds: async (albumId: string) => {
        if (albumId === "album-a-id") return ["photo1", "photo2", "photo3"];
        if (albumId === "default-album-id") return ["photo3"];
        return [];
      },
      createAlbum: mockCreateAlbum,
      batchAddMediaItems: mockBatchAddMediaItems,
      batchCreateAll: mockBatchCreateAll,
    } satisfies GooglePhotoClient;

    const result = await makeDiffAlbum("Album A", undefined, mockClient);

    // 結果の検証
    assert.equal(result.sourceAlbum, "Album A");
    assert.equal(result.excludeAlbum, "Default Album");
    assert.equal(result.addedCount, 2);

    // メソッド呼び出しの検証
    assert.equal(mockCreateAlbum.mock.callCount(), 1);
    assert.equal(mockBatchAddMediaItems.mock.callCount(), 1);

    // batchAddMediaItemsに正しい引数が渡されたことを確認
    assert.ok(mockBatchAddMediaItems.mock.calls.length > 0);
    const batchAddCall = mockBatchAddMediaItems.mock.calls[0];
    assert.ok(batchAddCall);
    assert.ok(batchAddCall.arguments);
    assert.ok(batchAddCall.arguments.length >= 2);
    assert.deepEqual(batchAddCall.arguments[0], ["photo1", "photo2"]); // 差分のメディアID
    assert.equal(batchAddCall.arguments[1], "new-album-id"); // 新しいアルバムID
  });

  test("異常系: GooglePhotoClientでエラーが発生した場合", async () => {
    const mockCreateAlbum = mock.fn(async () => ({ id: "new-album-id" }));
    const mockBatchAddMediaItems = mock.fn(
      async (_mediaIds: string[], _albumId: string) => {},
    );
    const mockBatchCreateAll = mock.fn(async () => {});
    const mockClient = {
      findAlbumIdByTitle: async () => {
        throw new Error("Album not found"); // エラーを発生させる
      },
      fetchAllMediaIds: async () => [],
      createAlbum: mockCreateAlbum,
      batchAddMediaItems: mockBatchAddMediaItems,
      batchCreateAll: mockBatchCreateAll,
    } satisfies GooglePhotoClient;

    // テスト実行
    await assert.rejects(
      async () => {
        await makeDiffAlbum("Album A", "Album B", mockClient);
      },
      {
        message: "Album not found",
      },
    );

    // エラーが発生した場合、createAlbumとbatchAddMediaItemsは呼ばれない
    assert.equal(mockCreateAlbum.mock.callCount(), 0);
    assert.equal(mockBatchAddMediaItems.mock.callCount(), 0);
  });
});
