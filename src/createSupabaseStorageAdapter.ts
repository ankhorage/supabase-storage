import { createClient } from '@supabase/supabase-js';

import { createStorageError, mapNetworkError, mapProviderError } from './errors.js';
import type {
  ListedAssetMetadata,
  ListInput,
  ListResult,
  PublicUrlInput,
  PublicUrlResult,
  RemoveInput,
  RemoveResult,
  SignedUrlInput,
  SignedUrlResult,
  StorageResult,
  SupabaseStorageAdapter,
  SupabaseStorageAdapterConfig,
  UploadInput,
  UploadResult,
} from './types.js';

interface NormalizedConfig {
  url: string;
  anonKey: string;
  bucket?: string;
}

type SupabaseClientLike = ReturnType<typeof createClient>;

const DEFAULT_LIST_LIMIT = 100;

export function createSupabaseStorageAdapter(
  config: SupabaseStorageAdapterConfig,
): SupabaseStorageAdapter {
  const normalizedConfigResult = normalizeConfig(config);

  const supabase = normalizedConfigResult.ok
    ? createSupabaseClient(normalizedConfigResult.data)
    : null;

  const invalidConfigError = normalizedConfigResult.ok ? null : normalizedConfigResult.error;

  const resolveBucket = (bucket: string | undefined): StorageResult<string> => {
    const resolved =
      bucket ?? (normalizedConfigResult.ok ? normalizedConfigResult.data.bucket : undefined);

    if (resolved === undefined || resolved.trim().length === 0) {
      return {
        ok: false,
        error: createStorageError('missing_bucket', 'Supabase Storage bucket is required.'),
      };
    }

    return { ok: true, data: resolved };
  };

  const resolvePath = (path: string): StorageResult<string> => {
    const normalized = path.trim().replace(/^\/+/, '');

    if (normalized.length === 0) {
      return {
        ok: false,
        error: createStorageError('validation_error', 'Storage path is required.'),
      };
    }

    return { ok: true, data: normalized };
  };

  const publicUrl = (input: PublicUrlInput): Promise<StorageResult<PublicUrlResult>> => {
    if (invalidConfigError !== null || supabase === null) {
      return Promise.resolve({ ok: false, error: invalidConfigError ?? invalidConfigFallback() });
    }

    const bucketResult = resolveBucket(input.bucket);
    if (!bucketResult.ok) return Promise.resolve(bucketResult);

    const pathResult = resolvePath(input.path);
    if (!pathResult.ok) return Promise.resolve(pathResult);

    try {
      const result = supabase.storage.from(bucketResult.data).getPublicUrl(pathResult.data);
      const url = extractUrl(result, ['publicUrl', 'publicURL']);

      if (url === null) {
        return Promise.resolve({
          ok: false,
          error: createStorageError(
            'provider_error',
            'Supabase Storage returned an invalid public URL response.',
            { operation: 'getPublicUrl', result },
          ),
        });
      }

      return Promise.resolve({
        ok: true,
        data: {
          asset: {
            bucket: bucketResult.data,
            path: pathResult.data,
            publicUrl: url,
          },
        },
      });
    } catch (error) {
      return Promise.resolve({ ok: false, error: mapNetworkError(error) });
    }
  };

  return {
    async upload(input: UploadInput): Promise<StorageResult<UploadResult>> {
      if (invalidConfigError !== null || supabase === null) {
        return { ok: false, error: invalidConfigError ?? invalidConfigFallback() };
      }

      const bucketResult = resolveBucket(input.bucket);
      if (!bucketResult.ok) return bucketResult;

      const pathResult = resolvePath(input.path);
      if (!pathResult.ok) return pathResult;

      try {
        const { error } = await supabase.storage
          .from(bucketResult.data)
          .upload(pathResult.data, input.body, {
            contentType: input.contentType,
            upsert: input.upsert,
            cacheControl: input.cacheControl,
          });

        if (error) {
          return { ok: false, error: mapProviderError('upload', error) };
        }

        const publicUrlResult = await publicUrl({
          bucket: bucketResult.data,
          path: pathResult.data,
        });
        if (!publicUrlResult.ok) return publicUrlResult;

        return {
          ok: true,
          data: {
            asset: {
              bucket: bucketResult.data,
              path: pathResult.data,
              publicUrl: publicUrlResult.data.asset.publicUrl,
              contentType: input.contentType ?? null,
              cacheControl: input.cacheControl ?? null,
              size: input.body.byteLength,
            },
          },
        };
      } catch (error) {
        return { ok: false, error: mapNetworkError(error) };
      }
    },

    async remove(input: RemoveInput): Promise<StorageResult<RemoveResult>> {
      if (invalidConfigError !== null || supabase === null) {
        return { ok: false, error: invalidConfigError ?? invalidConfigFallback() };
      }

      const bucketResult = resolveBucket(input.bucket);
      if (!bucketResult.ok) return bucketResult;

      const pathResult = resolvePath(input.path);
      if (!pathResult.ok) return pathResult;

      try {
        const { error } = await supabase.storage.from(bucketResult.data).remove([pathResult.data]);

        if (error) {
          return { ok: false, error: mapProviderError('remove', error) };
        }

        return {
          ok: true,
          data: {
            removed: { bucket: bucketResult.data, path: pathResult.data },
          },
        };
      } catch (error) {
        return { ok: false, error: mapNetworkError(error) };
      }
    },

    publicUrl,

    async getPublicUrl(input: PublicUrlInput): Promise<StorageResult<PublicUrlResult>> {
      return publicUrl(input);
    },

    async list(input: ListInput): Promise<StorageResult<ListResult>> {
      if (invalidConfigError !== null || supabase === null) {
        return { ok: false, error: invalidConfigError ?? invalidConfigFallback() };
      }

      const bucketResult = resolveBucket(input.bucket);
      if (!bucketResult.ok) return bucketResult;

      const limitResult = normalizeListLimit(input.limit);
      if (!limitResult.ok) return limitResult;

      const offsetResult = normalizeListCursor(input.cursor);
      if (!offsetResult.ok) return offsetResult;

      const prefix = normalizePrefix(input.prefix);

      try {
        const { data, error } = await supabase.storage.from(bucketResult.data).list(prefix, {
          limit: limitResult.data,
          offset: offsetResult.data,
          sortBy: { column: 'name', order: 'asc' },
        });

        if (error) {
          return { ok: false, error: mapProviderError('list', error) };
        }

        const assets = data
          .map((item) => normalizeListedAsset(item, bucketResult.data, prefix))
          .filter((item): item is ListedAssetMetadata => item !== null);
        const nextCursor =
          data.length < limitResult.data ? undefined : String(offsetResult.data + limitResult.data);

        return {
          ok: true,
          data: nextCursor === undefined ? { assets } : { assets, nextCursor },
        };
      } catch (error) {
        return { ok: false, error: mapNetworkError(error) };
      }
    },

    async createSignedUrl(input: SignedUrlInput): Promise<StorageResult<SignedUrlResult>> {
      if (invalidConfigError !== null || supabase === null) {
        return { ok: false, error: invalidConfigError ?? invalidConfigFallback() };
      }

      const bucketResult = resolveBucket(input.bucket);
      if (!bucketResult.ok) return bucketResult;

      const pathResult = resolvePath(input.path);
      if (!pathResult.ok) return pathResult;

      const expiryResult = normalizeExpiry(input.expiresInSeconds);
      if (!expiryResult.ok) return expiryResult;

      try {
        const result = await supabase.storage
          .from(bucketResult.data)
          .createSignedUrl(pathResult.data, expiryResult.data);

        if (result.error) {
          return { ok: false, error: mapProviderError('createSignedUrl', result.error) };
        }

        const signedUrl = extractUrl(result, ['signedUrl', 'signedURL']);
        if (signedUrl === null) {
          return {
            ok: false,
            error: createStorageError(
              'provider_error',
              'Supabase Storage returned an invalid signed URL response.',
              { operation: 'createSignedUrl', result },
            ),
          };
        }

        return {
          ok: true,
          data: {
            asset: {
              bucket: bucketResult.data,
              path: pathResult.data,
              signedUrl,
            },
          },
        };
      } catch (error) {
        return { ok: false, error: mapNetworkError(error) };
      }
    },
  };
}

function normalizeConfig(config: SupabaseStorageAdapterConfig): StorageResult<NormalizedConfig> {
  if (typeof config.url !== 'string' || config.url.trim().length === 0) {
    return {
      ok: false,
      error: createStorageError('invalid_config', 'Supabase Storage URL is required.'),
    };
  }

  if (typeof config.anonKey !== 'string' || config.anonKey.trim().length === 0) {
    return {
      ok: false,
      error: createStorageError('invalid_config', 'Supabase anon key is required.'),
    };
  }

  const trimmedUrl = config.url.trim();

  try {
    const parsed = new URL(trimmedUrl);
    const normalized = parsed.toString().replace(/\/+$/, '');

    return {
      ok: true,
      data: {
        url: normalized,
        anonKey: config.anonKey.trim(),
        bucket: config.bucket,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: createStorageError(
        'invalid_config',
        'Supabase Storage URL must be a valid URL.',
        error,
      ),
    };
  }
}

function createSupabaseClient(config: NormalizedConfig): SupabaseClientLike {
  return createClient(config.url, config.anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

function normalizeListLimit(value: number | undefined): StorageResult<number> {
  const limit = value ?? DEFAULT_LIST_LIMIT;
  return Number.isSafeInteger(limit) && limit > 0
    ? { ok: true, data: limit }
    : {
        ok: false,
        error: createStorageError(
          'validation_error',
          'Storage list limit must be a positive integer.',
        ),
      };
}

function normalizeListCursor(value: string | undefined): StorageResult<number> {
  if (value === undefined) return { ok: true, data: 0 };

  const offset = Number(value);
  return Number.isSafeInteger(offset) && offset >= 0 && String(offset) === value
    ? { ok: true, data: offset }
    : {
        ok: false,
        error: createStorageError('validation_error', 'Storage list cursor is invalid.'),
      };
}

function normalizeExpiry(value: number): StorageResult<number> {
  return Number.isSafeInteger(value) && value > 0
    ? { ok: true, data: value }
    : {
        ok: false,
        error: createStorageError(
          'validation_error',
          'Signed URL expiry must be a positive integer in seconds.',
        ),
      };
}

function normalizePrefix(value: string | undefined): string {
  return value?.trim().replace(/^\/+|\/+$/g, '') ?? '';
}

function normalizeListedAsset(
  value: unknown,
  bucket: string,
  prefix: string,
): ListedAssetMetadata | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string') {
    return null;
  }

  const metadata = isRecord(value.metadata) ? value.metadata : {};
  return {
    bucket,
    path: prefix.length === 0 ? value.name : `${prefix}/${value.name}`,
    contentType: readString(metadata.mimetype) ?? readString(metadata.contentType),
    size: readNumber(metadata.size),
    createdAt: readString(value.created_at),
    updatedAt: readString(value.updated_at),
    etag: readString(metadata.eTag) ?? readString(metadata.etag),
  };
}

function extractUrl(value: unknown, keys: readonly string[]): string | null {
  if (!isRecord(value)) return null;

  const containers = isRecord(value.data) ? [value.data, value] : [value];
  for (const container of containers) {
    for (const key of keys) {
      const candidate = container[key];
      if (typeof candidate === 'string' && candidate.length > 0) return candidate;
    }
  }

  return null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function invalidConfigFallback() {
  return createStorageError('invalid_config', 'Supabase Storage is not configured.');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
