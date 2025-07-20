import { google, Auth } from "googleapis";
import { Photo } from "./LookmeeClient";
import { fetchRetry } from "./fetchRetry";

type ConstructorArgs = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  refreshToken: string;
};

// Google Photos Album 型定義
type Album = {
  id: string;
  title: string;
  productUrl: string;
  mediaItemsCount: string;
};

// Google Photos MediaItem 型定義
type MediaItem = {
  id: string;
  productUrl: string;
  baseUrl: string;
  mimeType: string;
  filename: string;
};

// Albums list レスポンス型定義
type AlbumsListResponse = {
  albums: Album[];
  nextPageToken?: string;
};

// MediaItems search レスポンス型定義
type MediaItemsSearchResponse = {
  mediaItems: MediaItem[];
  nextPageToken?: string;
};

/**
 * Google Photos API client
 */
export class GooglePhotoClient {
  private oauth2Client: Auth.OAuth2Client;
  private accessToken: string | undefined;

  constructor(args: ConstructorArgs) {
    this.oauth2Client = new google.auth.OAuth2(
      args.clientId,
      args.clientSecret,
      args.redirectUri,
    );
    this.oauth2Client.setCredentials({
      refresh_token: args.refreshToken,
    });
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken) {
      return this.accessToken;
    }

    const accessTokenResponse = await this.oauth2Client.getAccessToken();
    if (!accessTokenResponse.token) {
      throw new Error("Failed to retrieve access token");
    }
    this.accessToken = accessTokenResponse.token;
    return this.accessToken;
  }

  async batchCreate(photos: Photo[], albumId: string) {
    const accessToken = await this.getAccessToken();

    const uploadTokens = await Promise.all(
      photos.map(async (photo) => {
        const response = await fetchRetry(photo.thumbnail_big_url);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.statusText}`);
        }
        const buffer = await response.arrayBuffer();

        const contentType =
          response.headers.get("content-type") ?? "image/jpeg";
        if (!contentType) {
          console.warn(
            "[WARN] Failed to determine content type:",
            photo.thumbnail_big_url,
          );
        }

        const uploadResponse = await fetchRetry(
          "https://photoslibrary.googleapis.com/v1/uploads",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-type": "application/octet-stream",
              "X-Goog-Upload-Content-Type": contentType,
              "X-Goog-Upload-Protocol": "raw",
            },
            body: buffer,
          },
        );

        if (!uploadResponse.ok) {
          throw new Error(
            `Failed to upload image: ${uploadResponse.statusText}`,
          );
        }

        return await uploadResponse.text();
      }),
    );

    const batchCreateResponse = await fetch(
      "https://photoslibrary.googleapis.com/v1/mediaItems:batchCreate",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          newMediaItems: uploadTokens.map((uploadToken, i) => ({
            simpleMediaItem: {
              uploadToken: uploadToken,
            },
            description: photos[i].id.toString(),
          })),
          albumId,
        }),
      },
    );

    if (!batchCreateResponse.ok) {
      throw new Error(
        `Failed to create media items: ${batchCreateResponse.statusText}`,
      );
    }

    return batchCreateResponse.json();
  }

  async batchCreateAll(photos: Photo[], albumId: string) {
    try {
      // 50枚ずつの画像に分けてアップロードします
      const BATCH_SIZE = 50;
      for (let i = 0; i < photos.length; i += BATCH_SIZE) {
        const sliced = photos.slice(i, i + BATCH_SIZE);
        const response = await this.batchCreate(sliced, albumId);
        // i回目のアップロードで何枚アップロードしたかを表示
        console.info(
          `${i / BATCH_SIZE + 1}th Batch upload completed:`,
          response.newMediaItemResults.length,
          "photos",
        );
      }
    } catch (error) {
      console.error("Failed to upload images to Google Photos", error);
    }
  }

  async createAlbum(title: string) {
    try {
      const accessToken = await this.getAccessToken();

      const response = await fetchRetry(
        "https://photoslibrary.googleapis.com/v1/albums",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            album: { title },
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to create album: ${response.statusText}`);
      }

      const albumData = await response.json();
      return albumData;
    } catch (error) {
      console.error("Error creating album:", error);
      throw error;
    }
  }

  /**
   * アルバム一覧を取得する
   * @returns アルバムの一覧
   */
  async listAlbums(): Promise<Album[]> {
    try {
      const accessToken = await this.getAccessToken();
      let albums: Album[] = [];
      let nextPageToken: string | undefined = undefined;

      do {
        const url = new URL("https://photoslibrary.googleapis.com/v1/albums");
        url.searchParams.append("pageSize", "50");

        // 2025-04-01以降はアプリが作成したアルバムのみが操作対象となるため、
        // アプリが作成したアルバムのみを表示するパラメータを追加
        url.searchParams.append("excludeNonAppCreatedData", "true");

        if (nextPageToken) {
          url.searchParams.append("pageToken", nextPageToken);
        }

        const response = await fetchRetry(url.toString(), {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to list albums: ${response.statusText}`);
        }

        const data = (await response.json()) as AlbumsListResponse;
        albums = albums.concat(data.albums || []);
        nextPageToken = data.nextPageToken;
      } while (nextPageToken);

      return albums;
    } catch (error) {
      console.error("Error listing albums:", error);
      throw error;
    }
  }

  /**
   * タイトルからアルバムIDを検索する
   * @param title アルバムのタイトル
   * @returns アルバムID（見つからない場合はエラー）
   */
  async findAlbumIdByTitle(title: string): Promise<string> {
    const albums = await this.listAlbums();
    const album = albums.find((album) => album.title === title);

    if (!album) {
      throw new Error(`Album not found with title: ${title}`);
    }

    return album.id;
  }

  /**
   * アルバムに含まれるすべてのメディアIDを取得する
   * @param albumId アルバムID
   * @returns メディアIDの配列
   */
  async fetchAllMediaIds(albumId: string): Promise<string[]> {
    try {
      const accessToken = await this.getAccessToken();
      let mediaIds: string[] = [];
      let nextPageToken: string | undefined = undefined;

      do {
        const response = await fetchRetry(
          "https://photoslibrary.googleapis.com/v1/mediaItems:search",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              albumId,
              pageSize: 100,
              ...(nextPageToken && { pageToken: nextPageToken }),
            }),
          },
        );

        if (!response.ok) {
          throw new Error(
            `Failed to search media items: ${response.statusText}`,
          );
        }

        const data = (await response.json()) as MediaItemsSearchResponse;
        const ids = (data.mediaItems || []).map((item) => item.id);
        mediaIds = mediaIds.concat(ids);
        nextPageToken = data.nextPageToken;

        console.info(
          `Fetched ${ids.length} media items from album, total: ${mediaIds.length}`,
        );
      } while (nextPageToken);

      return mediaIds;
    } catch (error) {
      console.error("Error fetching all media IDs:", error);
      throw error;
    }
  }

  /**
   * 既存のメディアをアルバムにバッチ追加する
   * @param mediaItemIds 追加するメディアID配列
   * @param albumId 追加先アルバムID
   */
  async batchAddMediaItems(
    mediaItemIds: string[],
    albumId: string,
  ): Promise<void> {
    if (mediaItemIds.length === 0) {
      console.info("No media items to add");
      return;
    }

    try {
      const accessToken = await this.getAccessToken();
      const BATCH_SIZE = 50; // 1回のAPIコールで最大50件まで

      for (let i = 0; i < mediaItemIds.length; i += BATCH_SIZE) {
        const batch = mediaItemIds.slice(i, i + BATCH_SIZE);
        const response = await fetchRetry(
          `https://photoslibrary.googleapis.com/v1/albums/${albumId}:batchAddMediaItems`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              mediaItemIds: batch,
            }),
          },
        );

        if (!response.ok) {
          throw new Error(`Failed to add media items: ${response.statusText}`);
        }

        console.info(
          `Added batch ${Math.floor(i / BATCH_SIZE) + 1}, ${batch.length} items`,
        );
      }
    } catch (error) {
      console.error("Error adding media items to album:", error);
      throw error;
    }
  }
}
