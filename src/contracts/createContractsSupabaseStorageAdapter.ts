import type { MediaStorageAdapter } from '@ankhorage/contracts/storage';

import { createSupabaseStorageAdapter } from '../createSupabaseStorageAdapter.js';
import type { SupabaseStorageAdapterConfig } from '../types.js';
import { toMediaStorageAdapter } from './toMediaStorageAdapter.js';

export function createContractsSupabaseStorageAdapter(
  config: SupabaseStorageAdapterConfig,
): MediaStorageAdapter {
  return toMediaStorageAdapter(createSupabaseStorageAdapter(config));
}
