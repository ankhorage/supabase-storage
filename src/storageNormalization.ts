import { createStorageError } from './errors.js';
import type { ListedAssetMetadata, StorageResult, SupabaseStorageAdapterConfig } from './types.js';

export interface NormalizedStorageConfig {
  readonly url: string;
  readonly anonKey: string;
  readonly bucket?: string;
}

const DEFAULT_LIST_LIMIT = 100;

export function extractStorageUrl(value: unknown, keys: readonly string[]): string | null {
  if (!isRecord(value)) return null;
  const containers = isRecord(value.data) ? [value.data, value] : [value];
  for (const container of containers) {
    const entries = new Map(Object.entries(container));
    for (const key of keys) {
      const candidate = entries.get(key);
      if (typeof candidate === 'string' && candidate.length > 0) return candidate;
    }
  }
  return null;
}

export function invalidConfigFallback() {
  return createStorageError('invalid_config', 'Supabase Storage is not configured.');
}

export function normalizeExpiry(value: number): StorageResult<number> {
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

export function normalizeListCursor(value: string | undefined): StorageResult<number> {
  if (value === undefined) return { ok: true, data: 0 };
  const offset = Number(value);
  return Number.isSafeInteger(offset) && offset >= 0 && String(offset) === value
    ? { ok: true, data: offset }
    : {
        ok: false,
        error: createStorageError('validation_error', 'Storage list cursor is invalid.'),
      };
}

export function normalizeListLimit(value: number | undefined): StorageResult<number> {
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

export function normalizeListedAsset(
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

export function normalizePrefix(value: string | undefined): string {
  return value?.trim().replace(/^\/+|\/+$/g, '') ?? '';
}

export function normalizeStorageConfig(
  config: SupabaseStorageAdapterConfig,
): StorageResult<NormalizedStorageConfig> {
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
  try {
    const parsed = new URL(config.url.trim());
    return {
      ok: true,
      data: {
        url: parsed.toString().replace(/\/+$/, ''),
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

export function resolveStorageBucket(
  config: NormalizedStorageConfig | null,
  bucket: string | undefined,
): StorageResult<string> {
  const resolved = bucket ?? config?.bucket;
  return resolved === undefined || resolved.trim().length === 0
    ? {
        ok: false,
        error: createStorageError('missing_bucket', 'Supabase Storage bucket is required.'),
      }
    : { ok: true, data: resolved };
}

export function resolveStoragePath(path: string): StorageResult<string> {
  const normalized = path.trim().replace(/^\/+/, '');
  return normalized.length === 0
    ? {
        ok: false,
        error: createStorageError('validation_error', 'Storage path is required.'),
      }
    : { ok: true, data: normalized };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
