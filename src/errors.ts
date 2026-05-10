import type { StorageAdapterError, StorageAdapterErrorCode } from './types.js';

export function createStorageError(
  code: StorageAdapterErrorCode,
  message: string,
  cause?: unknown,
): StorageAdapterError {
  return cause === undefined ? { code, message } : { code, message, cause };
}

export function mapNetworkError(cause: unknown): StorageAdapterError {
  return createStorageError('network_error', 'Unable to reach Supabase Storage.', cause);
}

export function mapProviderError(operation: string, providerError: unknown): StorageAdapterError {
  const message = extractErrorMessage(providerError) ?? 'Supabase Storage returned an error.';
  return createStorageError('provider_error', message, { operation, error: providerError });
}

export function extractErrorMessage(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  const candidates: unknown[] = [
    value.message,
    value.msg,
    value.error_description,
    value.error,
    value.error_code,
    value.code,
    value.statusText,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.length > 0) {
      return candidate;
    }
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
