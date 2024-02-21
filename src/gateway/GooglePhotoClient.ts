import { google, Auth } from "googleapis";
import { Photo } from "./LookmeeClient";
import { fetchRetry } from "./fetchRetry";

type ConstructorArgs = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  refreshToken: string;
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
      args.redirectUri
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

        const contentType = response.headers.get("content-type");
        if (!contentType) {
          throw new Error("Failed to determine content type");
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
          }
        );

        if (!uploadResponse.ok) {
          throw new Error(
            `Failed to upload image: ${uploadResponse.statusText}`
          );
        }

        return await uploadResponse.text();
      })
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
      }
    );

    if (!batchCreateResponse.ok) {
      throw new Error(
        `Failed to create media items: ${batchCreateResponse.statusText}`
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
          "photos"
        );
      }
    } catch (error) {
      console.error("Failed to upload images to Google Photos", error);
    }
  }

  async createAlbum(title: string) {
    try {
      const accessToken = await this.getAccessToken();

      const response = await fetch(
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
        }
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
}
