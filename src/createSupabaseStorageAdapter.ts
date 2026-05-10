import { createClient } from '@supabase/supabase-js';

import { createStorageError, mapNetworkError, mapProviderError } from './errors.js';
import type {
  PublicUrlInput,
  PublicUrlResult,
  RemoveInput,
  RemoveResult,
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
      const url = extractPublicUrl(result);

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

function extractPublicUrl(value: unknown): string | null {
  if (isRecord(value)) {
    if (isRecord(value.data)) {
      const candidate = value.data.publicUrl ?? value.data.publicURL;
      if (typeof candidate === 'string' && candidate.length > 0) {
        return candidate;
      }
    }

    const direct = value.publicUrl ?? value.publicURL;
    if (typeof direct === 'string' && direct.length > 0) {
      return direct;
    }
  }

  return null;
}

function invalidConfigFallback() {
  return createStorageError('invalid_config', 'Supabase Storage is not configured.');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
