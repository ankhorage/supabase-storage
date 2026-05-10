export type StorageResult<T> = { ok: true; data: T } | { ok: false; error: StorageAdapterError };

export type StorageAdapterErrorCode =
  | 'invalid_config'
  | 'missing_bucket'
  | 'validation_error'
  | 'network_error'
  | 'provider_error';

export interface StorageAdapterError {
  code: StorageAdapterErrorCode;
  message: string;
  cause?: unknown;
}

export interface SupabaseStorageAdapterConfig {
  url: string;
  anonKey: string;
  bucket?: string;
}

export type UploadBody = Uint8Array;

export interface UploadInput {
  bucket?: string;
  path: string;
  body: UploadBody;
  contentType?: string;
  upsert?: boolean;
  cacheControl?: string;
}

export interface RemoveInput {
  bucket?: string;
  path: string;
}

export interface PublicUrlInput {
  bucket?: string;
  path: string;
}

export interface AssetMetadata {
  bucket: string;
  path: string;
  publicUrl: string;
  contentType: string | null;
  cacheControl: string | null;
  size: number;
}

export interface UploadResult {
  asset: AssetMetadata;
}

export interface RemoveResult {
  removed: {
    bucket: string;
    path: string;
  };
}

export interface PublicUrlResult {
  asset: Pick<AssetMetadata, 'bucket' | 'path' | 'publicUrl'>;
}

export interface SupabaseStorageAdapter {
  upload(input: UploadInput): Promise<StorageResult<UploadResult>>;
  remove(input: RemoveInput): Promise<StorageResult<RemoveResult>>;
  publicUrl(input: PublicUrlInput): Promise<StorageResult<PublicUrlResult>>;
  getPublicUrl(input: PublicUrlInput): Promise<StorageResult<PublicUrlResult>>;
}
