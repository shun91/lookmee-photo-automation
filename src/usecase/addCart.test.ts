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
    const mockAddCart = mock.fn(
      async (args: {
        organizationId: number;
        salesId: number;
        photoId: number;
      }) => ({
        id: args.photoId,
        status: "added",
      }),
    );

    const mockClient = {
      addCart: mockAddCart,
      fetchAllPhotos: async () => [],
      getSalesId: async () => 67890,
    } satisfies LookmeeClient;

    const params: AddCartParams = {
      organizationId: 12345,
      salesId: 67890,
      photoIds: [1, 2, 3],
    };

    const result = await addCart(params, mockClient);

    // 結果の検証
    assert.equal(result.salesId, 67890);
    assert.deepEqual(result.photoIds, [1, 2, 3]);
    assert.equal(result.addedCount, 3);
    assert.equal(result.results.length, 3);

    // メソッド呼び出しの検証
    assert.equal(mockAddCart.mock.callCount(), 3);

    // 各呼び出しが正しい引数で実行されたことを確認
    const calls = mockAddCart.mock.calls;
    assert.deepEqual(calls[0].arguments[0], {
      organizationId: 12345,
      salesId: 67890,
      photoId: 1,
    });
    assert.deepEqual(calls[1].arguments[0], {
      organizationId: 12345,
      salesId: 67890,
      photoId: 2,
    });
    assert.deepEqual(calls[2].arguments[0], {
      organizationId: 12345,
      salesId: 67890,
      photoId: 3,
    });
  });

  test("正常系: 単一の写真をカートに追加", async () => {
    const mockAddCart = mock.fn(
      async (args: {
        organizationId: number;
        salesId: number;
        photoId: number;
      }) => ({
        id: args.photoId,
        status: "added",
      }),
    );

    const mockClient = {
      addCart: mockAddCart,
      fetchAllPhotos: async () => [],
      getSalesId: async () => 67890,
    } satisfies LookmeeClient;

    const params: AddCartParams = {
      organizationId: 12345,
      salesId: 67890,
      photoIds: [1],
    };

    const result = await addCart(params, mockClient);

    // 結果の検証
    assert.equal(result.salesId, 67890);
    assert.deepEqual(result.photoIds, [1]);
    assert.equal(result.addedCount, 1);
    assert.equal(result.results.length, 1);

    // メソッド呼び出しの検証
    assert.equal(mockAddCart.mock.callCount(), 1);

    // 呼び出しが正しい引数で実行されたことを確認
    const firstCall = mockAddCart.mock.calls[0];
    assert.deepEqual(firstCall.arguments[0], {
      organizationId: 12345,
      salesId: 67890,
      photoId: 1,
    });
  });

  test("正常系: salesIdを省略した場合は自動取得", async () => {
    const mockAddCart = mock.fn(
      async (args: {
        organizationId: number;
        salesId: number;
        photoId: number;
      }) => ({
        id: args.photoId,
        status: "added",
      }),
    );

    const mockGetSalesId = mock.fn(async () => 12345);

    const mockClient = {
      addCart: mockAddCart,
      fetchAllPhotos: async () => [],
      getSalesId: mockGetSalesId,
    } satisfies LookmeeClient;

    const params: AddCartParams = {
      organizationId: 12345,
      // salesIdは未指定
      photoIds: [1, 2, 3],
    };

    const result = await addCart(params, mockClient);

    // 結果の検証
    assert.equal(result.salesId, 12345); // 自動取得されたsalesId
    assert.deepEqual(result.photoIds, [1, 2, 3]);
    assert.equal(result.addedCount, 3);

    // メソッド呼び出しの検証
    assert.equal(mockGetSalesId.mock.callCount(), 1);
    assert.equal(mockAddCart.mock.callCount(), 3);

    // 各呼び出しが自動取得されたsalesIdで実行されたことを確認
    const calls = mockAddCart.mock.calls;
    assert.deepEqual(calls[0].arguments[0], {
      organizationId: 12345,
      salesId: 12345, // 自動取得されたsalesId
      photoId: 1,
    });
  });

  test("異常系: organizationIdが未指定の場合", async () => {
    const mockClient = {
      addCart: async () => {},
      fetchAllPhotos: async () => [],
      getSalesId: async () => 67890,
    } satisfies LookmeeClient;

    await assert.rejects(
      async () => {
        await addCart(
          {
            organizationId: 0,
            salesId: 67890,
            photoIds: [1, 2, 3],
          },
          mockClient,
        );
      },
      {
        message: "organizationId and photoIds are required",
      },
    );
  });

  test("異常系: photoIdsが空の場合", async () => {
    const mockClient = {
      addCart: async () => {},
      fetchAllPhotos: async () => [],
      getSalesId: async () => 67890,
    } satisfies LookmeeClient;

    await assert.rejects(
      async () => {
        await addCart(
          {
            organizationId: 12345,
            salesId: 67890,
            photoIds: [],
          },
          mockClient,
        );
      },
      {
        message: "organizationId and photoIds are required",
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
    } satisfies LookmeeClient;

    const params: AddCartParams = {
      organizationId: 12345,
      salesId: 67890,
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

    // エラーが発生した場合でも呼び出しは実行される（Promise.allによって並行実行される）
    assert.equal(mockAddCart.mock.callCount(), 3);
  });

  test("異常系: 一部の写真でエラーが発生した場合", async () => {
    const mockAddCart = mock.fn(
      async (args: {
        organizationId: number;
        salesId: number;
        photoId: number;
      }) => {
        if (args.photoId === 2) {
          throw new Error("Photo not found");
        }
        return {
          id: args.photoId,
          status: "added",
        };
      },
    );

    const mockClient = {
      addCart: mockAddCart,
      fetchAllPhotos: async () => [],
      getSalesId: async () => 67890,
    } satisfies LookmeeClient;

    const params: AddCartParams = {
      organizationId: 12345,
      salesId: 67890,
      photoIds: [1, 2, 3],
    };

    await assert.rejects(
      async () => {
        await addCart(params, mockClient);
      },
      {
        message: "Photo not found",
      },
    );

    // エラーが発生した場合でも呼び出しは実行される（Promise.allによって並行実行される）
    assert.equal(mockAddCart.mock.callCount(), 3);
  });

  test("異常系: salesId自動取得に失敗した場合", async () => {
    const mockGetSalesId = mock.fn(async () => 0); // 0を返してsalesIdエラーを引き起こす

    const mockClient = {
      addCart: async () => ({}),
      fetchAllPhotos: async () => [],
      getSalesId: mockGetSalesId,
    } satisfies LookmeeClient;

    const params: AddCartParams = {
      organizationId: 12345,
      // salesIdは未指定
      photoIds: [1, 2, 3],
    };

    await assert.rejects(
      async () => {
        await addCart(params, mockClient);
      },
      {
        message: "salesId could not be determined",
      },
    );
  });

  test("境界値: 大量の写真をカートに追加", async () => {
    const mockAddCart = mock.fn(
      async (args: {
        organizationId: number;
        salesId: number;
        photoId: number;
      }) => ({
        id: args.photoId,
        status: "added",
      }),
    );

    const mockClient = {
      addCart: mockAddCart,
      fetchAllPhotos: async () => [],
      getSalesId: async () => 67890,
    } satisfies LookmeeClient;

    const photoIds = Array.from({ length: 100 }, (_, i) => i + 1);
    const params: AddCartParams = {
      organizationId: 12345,
      salesId: 67890,
      photoIds,
    };

    const result = await addCart(params, mockClient);

    // 結果の検証
    assert.equal(result.salesId, 67890);
    assert.deepEqual(result.photoIds, photoIds);
    assert.equal(result.addedCount, 100);
    assert.equal(result.results.length, 100);

    // メソッド呼び出しの検証
    assert.equal(mockAddCart.mock.callCount(), 100);
  });
});
