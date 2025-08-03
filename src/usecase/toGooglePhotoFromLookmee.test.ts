import { test, describe, beforeEach, afterEach, mock } from "node:test";
import { strict as assert } from "node:assert";
import { toGooglePhotoFromLookmee } from "./toGooglePhotoFromLookmee";
import { GooglePhotoClient } from "../gateway/GooglePhotoClient";
import { LookmeeClient, Photo } from "../gateway/LookmeeClient";

describe("toGooglePhotoFromLookmee", () => {
  let originalEnv: string | undefined;
  let mockGooglePhotoClient: GooglePhotoClient;
  let mockLookmeeClient: LookmeeClient;
  let mockCreateAlbum: ReturnType<
    typeof mock.fn<
      (albumName: string) => Promise<{ id: string; title: string }>
    >
  >;
  let mockBatchCreateAll: ReturnType<
    typeof mock.fn<(photos: Photo[], albumId: string) => Promise<void>>
  >;
  let mockFetchAllPhotos: ReturnType<
    typeof mock.fn<
      (args: { groupId: number; eventId?: number }) => Promise<Photo[]>
    >
  >;

  beforeEach(() => {
    originalEnv = process.env.LOOKMEE_ORGANIZATION_ID;
    process.env.LOOKMEE_ORGANIZATION_ID = "123";

    mockCreateAlbum = mock.fn(async (albumName: string) => ({
      id: "album-id-123",
      title: albumName,
    }));
    mockBatchCreateAll = mock.fn(async () => {});

    mockGooglePhotoClient = {
      createAlbum: mockCreateAlbum,
      batchCreateAll: mockBatchCreateAll,
    } as unknown as GooglePhotoClient;

    mockFetchAllPhotos = mock.fn(
      async (args: { groupId: number; eventId?: number }) => [
        {
          id: 1,
          thumbnail_big_url: "https://example.com/photo1.jpg",
          file_no: 1,
        },
        {
          id: 2,
          thumbnail_big_url: "https://example.com/photo2.jpg",
          file_no: 2,
        },
        {
          id: 3,
          thumbnail_big_url: "https://example.com/photo3.jpg",
          file_no: 3,
        },
      ],
    );

    mockLookmeeClient = {
      fetchAllPhotos: mockFetchAllPhotos,
      addCart: async () => [],
      getSalesId: async () => 12345,
      getOrganizationId: async () => 123,
    } satisfies LookmeeClient;
  });

  afterEach(() => {
    process.env.LOOKMEE_ORGANIZATION_ID = originalEnv;
  });

  test("正常系: 写真を正常にアップロードする（salesId指定）", async () => {
    const result = await toGooglePhotoFromLookmee(
      12345,
      67890,
      [1, 2],
      "",
      mockGooglePhotoClient,
      mockLookmeeClient,
    );

    assert.match(result.albumName, /^lookmee-\d{6}-67890$/);
    assert.equal(result.albumId, "album-id-123");
    assert.equal(result.totalPhotos, 6);
    assert.equal(result.uploadedPhotos, 6);

    // Lookmee API が2回呼ばれることを確認
    assert.equal(mockFetchAllPhotos.mock.callCount(), 2);

    // アルバム作成が呼ばれることを確認
    assert.equal(mockCreateAlbum.mock.callCount(), 1);
    const createAlbumCall = mockCreateAlbum.mock.calls[0];
    assert.match(createAlbumCall.arguments[0], /^lookmee-\d{6}-67890$/);

    // バッチアップロードが呼ばれることを確認
    assert.equal(mockBatchCreateAll.mock.callCount(), 1);
    const batchCreateAllCall = mockBatchCreateAll.mock.calls[0];
    assert.equal(batchCreateAllCall.arguments[0].length, 6);
    assert.equal(batchCreateAllCall.arguments[1], "album-id-123");
  });

  test("正常系: salesId未指定の場合は自動取得", async () => {
    const result = await toGooglePhotoFromLookmee(
      undefined,
      67890,
      [1, 2],
      "",
      mockGooglePhotoClient,
      mockLookmeeClient,
    );

    assert.match(result.albumName, /^lookmee-\d{6}-67890$/);
    assert.equal(result.albumId, "album-id-123");
    assert.equal(result.totalPhotos, 6);
    assert.equal(result.uploadedPhotos, 6);

    // Lookmee API が2回呼ばれることを確認
    assert.equal(mockFetchAllPhotos.mock.callCount(), 2);

    // fetchAllPhotosの引数がgroupIdとeventIdのみであることを確認
    const fetchCall = mockFetchAllPhotos.mock.calls[0];
    assert.equal(fetchCall.arguments[0].groupId, 67890);
    assert.equal(fetchCall.arguments[0].eventId, 1);
  });

  test("正常系: uploadCountを指定した場合制限される", async () => {
    const result = await toGooglePhotoFromLookmee(
      12345,
      67890,
      [1, 2],
      "2",
      mockGooglePhotoClient,
      mockLookmeeClient,
    );

    assert.equal(result.totalPhotos, 6);
    assert.equal(result.uploadedPhotos, 2);

    // バッチアップロードが制限された枚数で呼ばれることを確認
    const batchCreateAllCall = mockBatchCreateAll.mock.calls[0];
    assert.equal(batchCreateAllCall.arguments[0].length, 2);
  });

  test("正常系: eventIdがundefinedの場合も動作する", async () => {
    const result = await toGooglePhotoFromLookmee(
      12345,
      67890,
      [undefined],
      "",
      mockGooglePhotoClient,
      mockLookmeeClient,
    );

    assert.equal(result.totalPhotos, 3);
    assert.equal(mockFetchAllPhotos.mock.callCount(), 1);

    const fetchAllPhotosCall = mockFetchAllPhotos.mock.calls[0];
    assert.equal(fetchAllPhotosCall.arguments[0].eventId, undefined);
  });

  test("正常系: アルバム名の形式が正しい", async () => {
    const now = new Date();
    const mockDate = new Date(now.getTime());
    mockDate.setMonth(mockDate.getMonth() - 1);
    const expectedYyyyMm = `${mockDate.getFullYear()}${String(
      mockDate.getMonth() + 1,
    ).padStart(2, "0")}`;
    const expectedAlbumName = `lookmee-${expectedYyyyMm}-67890`;

    const result = await toGooglePhotoFromLookmee(
      12345,
      67890,
      [1],
      "",
      mockGooglePhotoClient,
      mockLookmeeClient,
    );

    assert.equal(result.albumName, expectedAlbumName);
  });

  test("異常系: groupIdが未指定の場合エラー", async () => {
    await assert.rejects(
      async () => {
        await toGooglePhotoFromLookmee(
          12345,
          0,
          [1],
          "",
          mockGooglePhotoClient,
          mockLookmeeClient,
        );
      },
      { message: "groupId is required" },
    );
  });

  test("異常系: LookmeeClientでエラーが発生した場合", async () => {
    const mockFailClient = {
      fetchAllPhotos: mock.fn(async () => {
        throw new Error("Failed to fetch photos");
      }),
      addCart: async () => [],
      getSalesId: async () => 12345,
      getOrganizationId: async () => 123,
    } satisfies LookmeeClient;

    await assert.rejects(
      async () => {
        await toGooglePhotoFromLookmee(
          undefined,
          67890,
          [1],
          "",
          mockGooglePhotoClient,
          mockFailClient,
        );
      },
      { message: "Failed to fetch photos" },
    );
  });

  test("異常系: LookmeeClientでエラーが発生した場合", async () => {
    const mockErrorLookmeeClient = {
      fetchAllPhotos: mock.fn(async () => {
        throw new Error("Lookmee API error");
      }),
      addCart: async () => [],
      getSalesId: async () => 67890,
      getOrganizationId: async () => 123,
    } satisfies LookmeeClient;

    await assert.rejects(
      async () => {
        await toGooglePhotoFromLookmee(
          12345,
          67890,
          [1],
          "",
          mockGooglePhotoClient,
          mockErrorLookmeeClient,
        );
      },
      { message: "Lookmee API error" },
    );
  });

  test("異常系: GooglePhotoClientでエラーが発生した場合", async () => {
    const mockErrorGooglePhotoClient = {
      createAlbum: mock.fn(async () => {
        throw new Error("Google Photo API error");
      }),
      batchCreateAll: mock.fn(async () => {}),
    } as unknown as GooglePhotoClient;

    await assert.rejects(
      async () => {
        await toGooglePhotoFromLookmee(
          12345,
          67890,
          [1],
          "",
          mockErrorGooglePhotoClient,
          mockLookmeeClient,
        );
      },
      { message: "Google Photo API error" },
    );
  });

  test("境界値テスト: 空のeventIds配列", async () => {
    const result = await toGooglePhotoFromLookmee(
      12345,
      67890,
      [],
      "",
      mockGooglePhotoClient,
      mockLookmeeClient,
    );

    assert.equal(result.totalPhotos, 0);
    assert.equal(result.uploadedPhotos, 0);
    assert.equal(mockFetchAllPhotos.mock.callCount(), 0);
  });

  test("境界値テスト: uploadCountが0の場合", async () => {
    const result = await toGooglePhotoFromLookmee(
      12345,
      67890,
      [1],
      "0",
      mockGooglePhotoClient,
      mockLookmeeClient,
    );

    assert.equal(result.totalPhotos, 3);
    assert.equal(result.uploadedPhotos, 0);

    const batchCreateAllCall = mockBatchCreateAll.mock.calls[0];
    assert.equal(batchCreateAllCall.arguments[0].length, 0);
  });

  test("境界値テスト: 写真が0枚の場合", async () => {
    const mockEmptyLookmeeClient = {
      fetchAllPhotos: mock.fn(async () => []),
      addCart: async () => [],
      getSalesId: async () => 67890,
      getOrganizationId: async () => 123,
    } satisfies LookmeeClient;

    const result = await toGooglePhotoFromLookmee(
      12345,
      67890,
      [1],
      "",
      mockGooglePhotoClient,
      mockEmptyLookmeeClient,
    );

    assert.equal(result.totalPhotos, 0);
    assert.equal(result.uploadedPhotos, 0);

    const batchCreateAllCall = mockBatchCreateAll.mock.calls[0];
    assert.equal(batchCreateAllCall.arguments[0].length, 0);
  });
});
