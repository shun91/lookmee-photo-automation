import { test, describe, beforeEach, afterEach, mock } from "node:test";
import { strict as assert } from "node:assert";
import { LookmeeClient } from "../gateway/LookmeeClient";
import { addCart, AddCartParams } from "./addCart";

const originalEnv = process.env.LOOKMEE_ORGANIZATION_ID;
beforeEach(() => {
  process.env.LOOKMEE_ORGANIZATION_ID = originalEnv;
});
afterEach(() => {
  process.env.LOOKMEE_ORGANIZATION_ID = originalEnv;
});

describe("addCart", () => {
  test("正常系: 写真をカートに追加", async () => {
    const mockAddCart = mock.fn(async (photoIds: number[]) =>
      photoIds.map((id) => ({ id, status: "added" })),
    );

    const mockClient = {
      addCart: mockAddCart,
      fetchAllPhotos: async () => [],
      getSalesId: async () => 67890,
      getOrganizationId: async () => 12345,
    } satisfies LookmeeClient;

    const params: AddCartParams = {
      photoIds: [1, 2, 3],
    };

    const result = await addCart(params, mockClient);

    // 結果の検証
    assert.equal(result.salesId, 67890);
    assert.equal(result.organizationId, 12345);
    assert.deepEqual(result.photoIds, [1, 2, 3]);
    assert.equal(result.addedCount, 3);
    assert.equal(result.results.length, 3);

    // メソッド呼び出しの検証
    assert.equal(mockAddCart.mock.callCount(), 1);

    // 引数が正しいことを確認
    const firstCall = mockAddCart.mock.calls[0];
    assert.deepEqual(firstCall.arguments[0], [1, 2, 3]);
  });

  test("正常系: 単一の写真をカートに追加", async () => {
    const mockAddCart = mock.fn(async (photoIds: number[]) =>
      photoIds.map((id) => ({ id, status: "added" })),
    );

    const mockClient = {
      addCart: mockAddCart,
      fetchAllPhotos: async () => [],
      getSalesId: async () => 67890,
      getOrganizationId: async () => 12345,
    } satisfies LookmeeClient;

    const params: AddCartParams = {
      photoIds: [1],
    };

    const result = await addCart(params, mockClient);

    // 結果の検証
    assert.equal(result.salesId, 67890);
    assert.equal(result.organizationId, 12345);
    assert.deepEqual(result.photoIds, [1]);
    assert.equal(result.addedCount, 1);
    assert.equal(result.results.length, 1);

    // メソッド呼び出しの検証
    assert.equal(mockAddCart.mock.callCount(), 1);

    // 呼び出しが正しい引数で実行されたことを確認
    const firstCall = mockAddCart.mock.calls[0];
    assert.deepEqual(firstCall.arguments[0], [1]);
  });

  test("正常系: salesIdとorganizationIdは内部で自動取得", async () => {
    const mockAddCart = mock.fn(async (photoIds: number[]) =>
      photoIds.map((id) => ({ id, status: "added" })),
    );

    const mockGetSalesId = mock.fn(async () => 12345);
    const mockGetOrganizationId = mock.fn(async () => 67890);

    const mockClient = {
      addCart: mockAddCart,
      fetchAllPhotos: async () => [],
      getSalesId: mockGetSalesId,
      getOrganizationId: mockGetOrganizationId,
    } satisfies LookmeeClient;

    const params: AddCartParams = {
      photoIds: [1, 2, 3],
    };

    const result = await addCart(params, mockClient);

    // 結果の検証
    assert.equal(result.salesId, 12345); // 自動取得されたsalesId
    assert.equal(result.organizationId, 67890); // 自動取得されたorganizationId
    assert.deepEqual(result.photoIds, [1, 2, 3]);
    assert.equal(result.addedCount, 3);

    // メソッド呼び出しの検証
    assert.equal(mockGetSalesId.mock.callCount(), 1);
    assert.equal(mockGetOrganizationId.mock.callCount(), 1);
    assert.equal(mockAddCart.mock.callCount(), 1);

    // 呼び出しが正しい引数で実行されたことを確認
    const firstCall = mockAddCart.mock.calls[0];
    assert.deepEqual(firstCall.arguments[0], [1, 2, 3]);
  });

  test("異常系: photoIdsが空の場合", async () => {
    const mockClient = {
      addCart: async () => [],
      fetchAllPhotos: async () => [],
      getSalesId: async () => 67890,
      getOrganizationId: async () => 12345,
    } satisfies LookmeeClient;

    await assert.rejects(
      async () => {
        await addCart(
          {
            photoIds: [],
          },
          mockClient,
        );
      },
      {
        message: "photoIds are required",
      },
    );
  });

  test("異常系: LookmeeClientでエラーが発生した場合", async () => {
    const mockAddCart = mock.fn(async () => {
      throw new Error("API Error");
    });

    const mockClient = {
      addCart: mockAddCart,
      fetchAllPhotos: async () => [],
      getSalesId: async () => 67890,
      getOrganizationId: async () => 12345,
    } satisfies LookmeeClient;

    const params: AddCartParams = {
      photoIds: [1, 2, 3],
    };

    await assert.rejects(
      async () => {
        await addCart(params, mockClient);
      },
      {
        message: "API Error",
      },
    );

    // エラーが発生した場合でも呼び出しは実行される
    assert.equal(mockAddCart.mock.callCount(), 1);
  });

  test("異常系: salesId自動取得に失敗した場合", async () => {
    const mockGetSalesId = mock.fn(async () => {
      throw new Error("Failed to get salesId");
    });

    const mockClient = {
      addCart: async () => [{}],
      fetchAllPhotos: async () => [],
      getSalesId: mockGetSalesId,
      getOrganizationId: async () => 12345,
    } satisfies LookmeeClient;

    const params: AddCartParams = {
      photoIds: [1, 2, 3],
    };

    await assert.rejects(
      async () => {
        await addCart(params, mockClient);
      },
      {
        message: "Failed to get salesId",
      },
    );
  });

  test("境界値: 大量の写真をカートに追加", async () => {
    const mockAddCart = mock.fn(async (photoIds: number[]) =>
      photoIds.map((id) => ({ id, status: "added" })),
    );

    const mockClient = {
      addCart: mockAddCart,
      fetchAllPhotos: async () => [],
      getSalesId: async () => 67890,
      getOrganizationId: async () => 12345,
    } satisfies LookmeeClient;

    const photoIds = Array.from({ length: 100 }, (_, i) => i + 1);
    const params: AddCartParams = {
      photoIds,
    };

    const result = await addCart(params, mockClient);

    // 結果の検証
    assert.equal(result.salesId, 67890);
    assert.equal(result.organizationId, 12345);
    assert.deepEqual(result.photoIds, photoIds);
    assert.equal(result.addedCount, 100);
    assert.equal(result.results.length, 100);

    // メソッド呼び出しの検証
    assert.equal(mockAddCart.mock.callCount(), 1);
  });
});
