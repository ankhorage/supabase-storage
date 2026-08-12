import type {
  MediaStorageAdapter,
  StorageObjectMetadata,
  StorageResolveResult,
  StorageResult as ContractStorageResult,
} from '@ankhorage/contracts/storage';

import type { ListedAssetMetadata, SupabaseStorageAdapter } from '../types.js';

const DEFAULT_SIGNED_URL_EXPIRY_SECONDS = 900;

export function toMediaStorageAdapter(adapter: SupabaseStorageAdapter): MediaStorageAdapter {
  return {
    async upload(input) {
      const result = await adapter.upload({
        bucket: input.bucket,
        path: input.path,
        body: input.body,
        contentType: input.contentType,
        cacheControl: input.cacheControl,
        upsert: input.upsert,
      });
      if (!result.ok) return result;

      return {
        ok: true,
        data: {
          asset: {
            storageId: input.storageId,
            bucket: result.data.asset.bucket,
            path: result.data.asset.path,
          },
        },
      };
    },

    async remove(input) {
      const result = await adapter.remove({ bucket: input.bucket, path: input.path });
      return result.ok ? { ok: true } : result;
    },

    async publicUrl(input) {
      const result = await adapter.publicUrl({ bucket: input.bucket, path: input.path });
      return result.ok
        ? { ok: true, data: { publicUrl: result.data.asset.publicUrl } }
        : result;
    },

    async list(input) {
      const result = await adapter.list({
        bucket: input.bucket,
        prefix: input.prefix,
        cursor: input.cursor,
        limit: input.limit,
      });
      if (!result.ok) return result;

      const objects = result.data.assets.map((asset) =>
        toStorageObjectMetadata(asset, input.storageId),
      );
      return {
        ok: true,
        data:
          result.data.nextCursor === undefined
            ? { objects }
            : { objects, nextCursor: result.data.nextCursor },
      };
    },

    async resolve(input): Promise<ContractStorageResult<StorageResolveResult>> {
      const access = input.access ?? 'signed';
      if (access === 'public') {
        const result = await adapter.publicUrl({ bucket: input.bucket, path: input.path });
        if (!result.ok) return result;
        return {
          ok: true,
          data: {
            asset: {
              storageId: input.storageId,
              bucket: result.data.asset.bucket,
              path: result.data.asset.path,
              url: result.data.asset.publicUrl,
              access,
            },
          },
        };
      }

      const result = await adapter.createSignedUrl({
        bucket: input.bucket,
        path: input.path,
        expiresInSeconds: input.expiresInSeconds ?? DEFAULT_SIGNED_URL_EXPIRY_SECONDS,
      });
      if (!result.ok) return result;
      return {
        ok: true,
        data: {
          asset: {
            storageId: input.storageId,
            bucket: result.data.asset.bucket,
            path: result.data.asset.path,
            url: result.data.asset.signedUrl,
            access,
          },
        },
      };
    },
  };
}

function toStorageObjectMetadata(
  asset: ListedAssetMetadata,
  storageId: string | undefined,
): StorageObjectMetadata {
  return {
    storageId,
    bucket: asset.bucket,
    path: asset.path,
    ...(asset.contentType === null ? {} : { contentType: asset.contentType }),
    ...(asset.size === null ? {} : { sizeBytes: asset.size }),
    ...(asset.createdAt === null ? {} : { createdAt: asset.createdAt }),
    ...(asset.updatedAt === null ? {} : { updatedAt: asset.updatedAt }),
    ...(asset.etag === null ? {} : { etag: asset.etag }),
  };
}
