import { createClient } from '@supabase/supabase-js';

import { createStorageError, mapNetworkError, mapProviderError } from './errors.js';
import {
  extractStorageUrl,
  invalidConfigFallback,
  type NormalizedStorageConfig,
  normalizeExpiry,
  normalizeListCursor,
  normalizeListedAsset,
  normalizeListLimit,
  normalizePrefix,
  normalizeStorageConfig,
  resolveStorageBucket,
  resolveStoragePath,
} from './storageNormalization.js';
import type {
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

type SupabaseClientLike = ReturnType<typeof createClient>;
type StorageFailure = Extract<StorageResult<unknown>, { readonly ok: false }>;

interface StorageContext {
  readonly config: NormalizedStorageConfig | null;
  readonly invalidConfigError: StorageFailure | null;
  readonly supabase: SupabaseClientLike | null;
}

interface ValidStorageContext {
  readonly config: NormalizedStorageConfig;
  readonly supabase: SupabaseClientLike;
}

export function createSupabaseStorageAdapter(
  config: SupabaseStorageAdapterConfig,
): SupabaseStorageAdapter {
  const context = createStorageContext(config);
  return {
    upload: (input) => uploadAsset(context, input),
    remove: (input) => removeAsset(context, input),
    publicUrl: (input) => getPublicUrl(context, input),
    getPublicUrl: (input) => getPublicUrl(context, input),
    list: (input) => listAssets(context, input),
    createSignedUrl: (input) => createSignedAssetUrl(context, input),
  };
}

async function createSignedAssetUrl(
  context: StorageContext,
  input: SignedUrlInput,
): Promise<StorageResult<SignedUrlResult>> {
  const ready = resolveStorageContext(context);
  if (!ready.ok) return ready;
  const bucket = resolveStorageBucket(ready.data.config, input.bucket);
  if (!bucket.ok) return bucket;
  const path = resolveStoragePath(input.path);
  if (!path.ok) return path;
  const expiry = normalizeExpiry(input.expiresInSeconds);
  if (!expiry.ok) return expiry;
  try {
    const result = await ready.data.supabase.storage
      .from(bucket.data)
      .createSignedUrl(path.data, expiry.data);
    if (result.error)
      return { ok: false, error: mapProviderError('createSignedUrl', result.error) };
    const signedUrl = extractStorageUrl(result, ['signedUrl', 'signedURL']);
    if (signedUrl === null) return invalidUrlResponse('signed', result);
    return {
      ok: true,
      data: { asset: { bucket: bucket.data, path: path.data, signedUrl } },
    };
  } catch (error) {
    return { ok: false, error: mapNetworkError(error) };
  }
}

function createStorageContext(config: SupabaseStorageAdapterConfig): StorageContext {
  const normalized = normalizeStorageConfig(config);
  if (!normalized.ok) {
    return { config: null, invalidConfigError: normalized, supabase: null };
  }
  return {
    config: normalized.data,
    invalidConfigError: null,
    supabase: createSupabaseClient(normalized.data),
  };
}

function createSupabaseClient(config: NormalizedStorageConfig): SupabaseClientLike {
  return createClient(config.url, config.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

function resolveStorageContext(context: StorageContext): StorageResult<ValidStorageContext> {
  if (context.config === null || context.invalidConfigError !== null || context.supabase === null) {
    return {
      ok: false,
      error: context.invalidConfigError?.error ?? invalidConfigFallback(),
    };
  }
  return { ok: true, data: { config: context.config, supabase: context.supabase } };
}

function getPublicUrl(
  context: StorageContext,
  input: PublicUrlInput,
): Promise<StorageResult<PublicUrlResult>> {
  const ready = resolveStorageContext(context);
  if (!ready.ok) return Promise.resolve(ready);
  const bucket = resolveStorageBucket(ready.data.config, input.bucket);
  if (!bucket.ok) return Promise.resolve(bucket);
  const path = resolveStoragePath(input.path);
  if (!path.ok) return Promise.resolve(path);
  try {
    const result = ready.data.supabase.storage.from(bucket.data).getPublicUrl(path.data);
    const publicUrl = extractStorageUrl(result, ['publicUrl', 'publicURL']);
    if (publicUrl === null) return Promise.resolve(invalidUrlResponse('public', result));
    return Promise.resolve({
      ok: true,
      data: { asset: { bucket: bucket.data, path: path.data, publicUrl } },
    });
  } catch (error) {
    return Promise.resolve({ ok: false, error: mapNetworkError(error) });
  }
}

function invalidUrlResponse(kind: 'public', result: unknown): StorageFailure;
function invalidUrlResponse(kind: 'signed', result: unknown): StorageFailure;
function invalidUrlResponse(kind: 'public' | 'signed', result: unknown): StorageFailure {
  const operation = kind === 'public' ? 'getPublicUrl' : 'createSignedUrl';
  return {
    ok: false,
    error: createStorageError(
      'provider_error',
      `Supabase Storage returned an invalid ${kind} URL response.`,
      { operation, result },
    ),
  };
}

async function listAssets(
  context: StorageContext,
  input: ListInput,
): Promise<StorageResult<ListResult>> {
  const ready = resolveStorageContext(context);
  if (!ready.ok) return ready;
  const bucket = resolveStorageBucket(ready.data.config, input.bucket);
  if (!bucket.ok) return bucket;
  const limit = normalizeListLimit(input.limit);
  if (!limit.ok) return limit;
  const offset = normalizeListCursor(input.cursor);
  if (!offset.ok) return offset;
  const prefix = normalizePrefix(input.prefix);
  try {
    const { data, error } = await ready.data.supabase.storage.from(bucket.data).list(prefix, {
      limit: limit.data,
      offset: offset.data,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) return { ok: false, error: mapProviderError('list', error) };
    const assets = data
      .map((item) => normalizeListedAsset(item, bucket.data, prefix))
      .filter((item) => item !== null);
    const nextCursor = data.length < limit.data ? undefined : String(offset.data + limit.data);
    return { ok: true, data: nextCursor === undefined ? { assets } : { assets, nextCursor } };
  } catch (error) {
    return { ok: false, error: mapNetworkError(error) };
  }
}

async function removeAsset(
  context: StorageContext,
  input: RemoveInput,
): Promise<StorageResult<RemoveResult>> {
  const ready = resolveStorageContext(context);
  if (!ready.ok) return ready;
  const bucket = resolveStorageBucket(ready.data.config, input.bucket);
  if (!bucket.ok) return bucket;
  const path = resolveStoragePath(input.path);
  if (!path.ok) return path;
  try {
    const { error } = await ready.data.supabase.storage.from(bucket.data).remove([path.data]);
    if (error) return { ok: false, error: mapProviderError('remove', error) };
    return { ok: true, data: { removed: { bucket: bucket.data, path: path.data } } };
  } catch (error) {
    return { ok: false, error: mapNetworkError(error) };
  }
}

async function uploadAsset(
  context: StorageContext,
  input: UploadInput,
): Promise<StorageResult<UploadResult>> {
  const ready = resolveStorageContext(context);
  if (!ready.ok) return ready;
  const bucket = resolveStorageBucket(ready.data.config, input.bucket);
  if (!bucket.ok) return bucket;
  const path = resolveStoragePath(input.path);
  if (!path.ok) return path;
  try {
    const { error } = await ready.data.supabase.storage
      .from(bucket.data)
      .upload(path.data, input.body, {
        contentType: input.contentType,
        upsert: input.upsert,
        cacheControl: input.cacheControl,
      });
    if (error) return { ok: false, error: mapProviderError('upload', error) };
    const publicUrl = await getPublicUrl(context, { bucket: bucket.data, path: path.data });
    if (!publicUrl.ok) return publicUrl;
    return {
      ok: true,
      data: {
        asset: {
          bucket: bucket.data,
          path: path.data,
          publicUrl: publicUrl.data.asset.publicUrl,
          contentType: input.contentType ?? null,
          cacheControl: input.cacheControl ?? null,
          size: input.body.byteLength,
        },
      },
    };
  } catch (error) {
    return { ok: false, error: mapNetworkError(error) };
  }
}
