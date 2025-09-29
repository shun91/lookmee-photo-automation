import { fetchRetry } from "./fetchRetry";
import { getLookmeeAuth, LookmeeAuthResult } from "./getLookmeeAuth";

type FetchArgs = {
  organizationId: number;
  salesId: number;
  groupId: number;
  eventId?: number;
  page: number;
};

type AddCartArgs = {
  organizationId: number;
  salesId: number;
  photoId: number;
};

export type Photo = {
  id: number;
  thumbnail_big_url: string;
  file_no: number;
};

type Item = {
  picture: Photo;
};

type ItemsResponse = {
  sales_items: Item[];
  meta: {
    pagination: {
      all_pages: number;
    };
  };
};

/**
 * Lookmee API client interface
 */
export interface LookmeeClient {
  fetchAllPhotos(args: { groupId: number; eventId?: number }): Promise<Photo[]>;
  addCart(photoIds: number[]): Promise<any[]>;
  getSalesId(): Promise<number>;
  getOrganizationId(): Promise<number>;
}

/**
 * Lookmee API クライアント実装
 */
export class LookmeeClientImpl implements LookmeeClient {
  /**
   * Lookmee API トークンとsalesId
   */
  private lookmeeAuthResult: LookmeeAuthResult | null = null;
  private authPromise: Promise<LookmeeAuthResult> | null = null;
  private organizationId: number;

  /**
   * @param lookmeeToken トークンを明示的に指定する場合（指定しない場合は自動的に取得）
   * @param salesId salesIdを明示的に指定する場合（指定しない場合は自動的に取得）
   */
  constructor(lookmeeToken?: string, salesId?: string) {
    // organizationIdを環境変数から取得
    this.organizationId = Number(process.env.LOOKMEE_ORGANIZATION_ID);
    if (!this.organizationId) {
      throw new Error(
        "LOOKMEE_ORGANIZATION_ID environment variable is required",
      );
    }

    if (lookmeeToken && salesId) {
      this.lookmeeAuthResult = {
        lookmeeToken,
        salesId,
      };
    }
  }

  /**
   * Lookmee認証情報（トークンとsalesId）を取得する
   * キャッシュがあればそれを返し、なければ新たに取得する
   *
   * @returns Lookmee APIトークンとsalesId
   */
  private async getAuthResult(): Promise<LookmeeAuthResult> {
    // 認証情報が明示的に指定されている場合はそれを返す
    if (this.lookmeeAuthResult) {
      return this.lookmeeAuthResult;
    }

    // 認証情報取得中の場合は同じPromiseを返す（重複リクエスト防止）
    if (this.authPromise) {
      return this.authPromise;
    }

    // 認証情報を取得
    this.authPromise = getLookmeeAuth();
    try {
      this.lookmeeAuthResult = await this.authPromise;
      return this.lookmeeAuthResult;
    } finally {
      // リクエスト完了後にPromiseをクリア
      this.authPromise = null;
    }
  }

  /**
   * テスト用: Lookmeeトークンを取得する
   * このメソッドは公開APIのため、テスト目的でのみ使用すること
   *
   * @returns Lookmee APIトークン
   */
  async getTokenForTest(): Promise<string> {
    const authResult = await this.getAuthResult();
    return authResult.lookmeeToken;
  }

  /**
   * SalesIdを取得する
   *
   * @returns salesId（数値）
   */
  async getSalesId(): Promise<number> {
    const authResult = await this.getAuthResult();
    return Number(authResult.salesId);
  }

  /**
   * OrganizationIdを取得する
   *
   * @returns organizationId（数値）
   */
  async getOrganizationId(): Promise<number> {
    return this.organizationId;
  }

  /**
   * テスト用: Lookmee認証情報（トークンとsalesId）を取得する
   * このメソッドは公開APIのため、テスト目的でのみ使用すること
   *
   * @returns Lookmee APIトークンとsalesId
   */
  async getAuthResultForTest(): Promise<LookmeeAuthResult> {
    return this.getAuthResult();
  }

  /**
   * Lookmee API から写真を取得
   *
   * @returns 写真のURLとファイル番号の配列
   */
  private async fetchItems({
    organizationId,
    salesId,
    groupId,
    eventId,
    page,
  }: FetchArgs) {
    const authResult = await this.getAuthResult();
    const token = authResult.lookmeeToken;
    const response = await fetchRetry(
      `https://photo.lookmee.jp/site/api/organizations/${organizationId}/sales_managements/${salesId}/sales_items?group_id=${groupId}&event_id=${eventId}&page=${page}`,
      { headers: { cookie: `_lookmee_photo_session=${token}` } },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch photos: ${response.statusText}`);
    }

    const items: ItemsResponse = await response.json();

    return items;
  }

  /**
   * Lookmee API からページネーションを考慮してすべての写真を取得
   *
   * @returns 写真のURLとファイル番号の配列
   */
  async fetchAllPhotos({
    groupId,
    eventId,
  }: {
    groupId: number;
    eventId?: number;
  }) {
    // 内部で認証情報を取得
    const authResult = await this.getAuthResult();
    const salesId = Number(authResult.salesId);

    const items = await this.fetchItems({
      organizationId: this.organizationId,
      salesId,
      groupId,
      eventId,
      page: 1,
    });
    const allItems = [...items.sales_items];

    for (let i = 2; i <= items.meta.pagination.all_pages; i++) {
      const nextPhotos = await this.fetchItems({
        organizationId: this.organizationId,
        salesId,
        groupId,
        eventId,
        page: i,
      });
      allItems.push(...nextPhotos.sales_items);
    }

    return allItems.map((i) => i.picture);
  }

  async addCart(photoIds: number[]): Promise<any[]> {
    const authResult = await this.getAuthResult();
    const salesId = Number(authResult.salesId);

    return Promise.all(
      photoIds.map((photoId) =>
        this.addCartSingle({
          organizationId: this.organizationId,
          salesId,
          photoId,
        }),
      ),
    );
  }

  private async addCartSingle({
    organizationId,
    salesId,
    photoId,
  }: AddCartArgs) {
    const authResult = await this.getAuthResult();
    const token = authResult.lookmeeToken;
    const response = await fetchRetry(
      `https://photo.lookmee.jp/site/api/organizations/${organizationId}/sales_managements/${salesId}/cart/pictures`,
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          cookie: `_lookmee_photo_session=${token}`,
          // カート追加APIは適切なrefererを指定しないと403が返る
          referer: `https://photo.lookmee.jp/site/organizations/${organizationId}/sales_managements/${salesId}`,
        },
        body: JSON.stringify({ cart_picture: { id: photoId, count: 1 } }),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Failed to add cart: ${response.statusText} (photoId: ${photoId})`,
      );
    }

    const cart = await response.json();

    return cart;
  }
}
