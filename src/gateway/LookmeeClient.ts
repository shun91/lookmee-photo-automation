import { fetchRetry } from "./fetchRetry";

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
  private lookmeeToken: string;

  constructor(lookmeeToken: string) {
    this.lookmeeToken = lookmeeToken;
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
    const response = await fetchRetry(
      `https://photo.lookmee.jp/site/api/organizations/${organizationId}/sales_managements/${salesId}/sales_items?group_id=${groupId}&event_id=${eventId}&page=${page}`,
      { headers: { cookie: `_lookmee_photo_session=${this.lookmeeToken}` } }
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
    const response = await fetchRetry(
      `https://photo.lookmee.jp/site/api/organizations/${organizationId}/sales_managements/${salesId}/cart/pictures`,
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          cookie: `_lookmee_photo_session=${this.lookmeeToken}`,
          // カート追加APIは適切なrefererを指定しないと403が返る
          referer: `https://photo.lookmee.jp/site/organizations/${organizationId}/sales_managements/${salesId}`,
        },
        body: JSON.stringify({ cart_picture: { id: photoId, count: 1 } }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to add cart: ${response.statusText}`);
    }

    const cart = await response.json();

    return cart;
  }
}
