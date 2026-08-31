import type {
  MediaStorageAdapter,
  StorageListInput,
  StorageRemoveInput,
  StorageResolveInput,
  StorageResolveResult,
  StorageResult as ContractStorageResult,
  StorageUploadInput,
  StorageUploadResult,
} from '@ankhorage/contracts/storage';

import type { ListedAssetMetadata, SupabaseStorageAdapter } from '../types.js';

const DEFAULT_SIGNED_URL_EXPIRY_SECONDS = 900;

export function toMediaStorageAdapter(adapter: SupabaseStorageAdapter): MediaStorageAdapter {
  return {
    upload: (input) => uploadMedia(adapter, input),
    remove: (input) => removeMedia(adapter, input),
    publicUrl: async (input) => {
      const result = await adapter.publicUrl({ bucket: input.bucket, path: input.path });
      return result.ok ? { ok: true, data: { publicUrl: result.data.asset.publicUrl } } : result;
    },
    list: (input) => listMedia(adapter, input),
    resolve: (input) => resolveMedia(adapter, input),
  };
}

async function listMedia(adapter: SupabaseStorageAdapter, input: StorageListInput) {
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
    ok: true as const,
    data:
      result.data.nextCursor === undefined
        ? { objects }
        : { objects, nextCursor: result.data.nextCursor },
  };
}

async function removeMedia(adapter: SupabaseStorageAdapter, input: StorageRemoveInput) {
  const result = await adapter.remove({ bucket: input.bucket, path: input.path });
  return result.ok ? { ok: true as const } : result;
}

async function resolveMedia(
  adapter: SupabaseStorageAdapter,
  input: StorageResolveInput,
): Promise<ContractStorageResult<StorageResolveResult>> {
  const access = input.access ?? 'signed';
  if (access === 'public') return resolvePublicMedia(adapter, input);
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
}

async function resolvePublicMedia(
  adapter: SupabaseStorageAdapter,
  input: StorageResolveInput,
): Promise<ContractStorageResult<StorageResolveResult>> {
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
        access: 'public',
      },
    },
  };
}

function toStorageObjectMetadata(asset: ListedAssetMetadata, storageId: string | undefined) {
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

async function uploadMedia(
  adapter: SupabaseStorageAdapter,
  input: StorageUploadInput,
): Promise<ContractStorageResult<StorageUploadResult>> {
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
}
