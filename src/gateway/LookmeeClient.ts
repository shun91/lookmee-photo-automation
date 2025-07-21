import { fetchRetry } from "./fetchRetry";
import { getLookmeeToken } from "./getLookmeeToken";

type FetchArgs = {
  organizationId: number;
  salesId: number;
  groupId: number;
  eventId?: number;
  page: number;
};

type FetchAllArgs = Omit<FetchArgs, "page">;

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
 * Lookmee API クライアント
 */
export class LookmeeClient {
  /**
   * Lookmee API トークン
   */
  private lookmeeToken: string | null = null;
  private tokenPromise: Promise<string> | null = null;

  /**
   * @param lookmeeToken トークンを明示的に指定する場合（指定しない場合は自動的に取得）
   */
  constructor(lookmeeToken?: string) {
    if (lookmeeToken) {
      this.lookmeeToken = lookmeeToken;
    }
  }

  /**
   * Lookmeeトークンを取得する
   * キャッシュがあればそれを返し、なければ新たに取得する
   *
   * @returns Lookmee APIトークン
   */
  private async getToken(): Promise<string> {
    // トークンが明示的に指定されている場合はそれを返す
    if (this.lookmeeToken) {
      return this.lookmeeToken;
    }

    // トークン取得中の場合は同じPromiseを返す（重複リクエスト防止）
    if (this.tokenPromise) {
      return this.tokenPromise;
    }

    // トークンを取得
    this.tokenPromise = getLookmeeToken();
    try {
      this.lookmeeToken = await this.tokenPromise;
      return this.lookmeeToken;
    } finally {
      // リクエスト完了後にPromiseをクリア
      this.tokenPromise = null;
    }
  }

  /**
   * テスト用: Lookmeeトークンを取得する
   * このメソッドは公開APIのため、テスト目的でのみ使用すること
   *
   * @returns Lookmee APIトークン
   */
  async getTokenForTest(): Promise<string> {
    return this.getToken();
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
    const token = await this.getToken();
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
  async fetchAllPhotos(args: FetchAllArgs) {
    const items = await this.fetchItems({ ...args, page: 1 });
    const allItems = [...items.sales_items];

    for (let i = 2; i <= items.meta.pagination.all_pages; i++) {
      const nextPhotos = await this.fetchItems({ ...args, page: i });
      allItems.push(...nextPhotos.sales_items);
    }

    return allItems.map((i) => i.picture);
  }

  async addCart({ organizationId, salesId, photoId }: AddCartArgs) {
    const token = await this.getToken();
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
      throw new Error(`Failed to add cart: ${response.statusText}`);
    }

    const cart = await response.json();

    return cart;
  }
}
