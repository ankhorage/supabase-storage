import { mock } from 'bun:test';

export interface CreateClientCall {
  url: string;
  anonKey: string;
  options: unknown;
}

interface ProviderResponse {
  data: unknown;
  error: unknown;
}

interface BucketApiStub {
  uploadCalls: [
    string,
    Uint8Array,
    { contentType?: string; upsert?: boolean; cacheControl?: string },
  ][];
  removeCalls: [string[]][];
  getPublicUrlCalls: [string][];
  listCalls: [
    string,
    { limit: number; offset: number; sortBy: { column: string; order: string } },
  ][];
  createSignedUrlCalls: [string, number][];
  uploadResponse: ProviderResponse;
  removeResponse: ProviderResponse;
  listResponse: ProviderResponse;
  signedUrlResponse: ProviderResponse;
  removeThrows: Error | null;
  upload(
    path: string,
    body: Uint8Array,
    options: { contentType?: string; upsert?: boolean; cacheControl?: string },
  ): Promise<ProviderResponse>;
  remove(paths: string[]): Promise<ProviderResponse>;
  getPublicUrl(path: string): { data: { publicUrl: string } };
  list(
    prefix: string,
    options: { limit: number; offset: number; sortBy: { column: string; order: string } },
  ): Promise<ProviderResponse>;
  createSignedUrl(path: string, expiresInSeconds: number): Promise<ProviderResponse>;
}

export interface SupabaseClientStub {
  fromCalls: string[];
  bucket: BucketApiStub;
  storage: { from(bucket: string): BucketApiStub };
}

export function createSupabaseClientStub(): SupabaseClientStub {
  const fromCalls: string[] = [];
  let currentBucket = '';
  const bucket: BucketApiStub = {
    uploadCalls: [],
    removeCalls: [],
    getPublicUrlCalls: [],
    listCalls: [],
    createSignedUrlCalls: [],
    uploadResponse: { data: { path: 'ignored' }, error: null },
    removeResponse: { data: [], error: null },
    listResponse: { data: [], error: null },
    signedUrlResponse: { data: { signedUrl: 'https://signed.example/hero.png' }, error: null },
    removeThrows: null,
    upload(path, body, options) {
      bucket.uploadCalls.push([path, body, options]);
      return Promise.resolve(bucket.uploadResponse);
    },
    remove(paths) {
      bucket.removeCalls.push([paths]);
      return bucket.removeThrows === null
        ? Promise.resolve(bucket.removeResponse)
        : Promise.reject(bucket.removeThrows);
    },
    getPublicUrl(path) {
      bucket.getPublicUrlCalls.push([path]);
      return { data: { publicUrl: `https://cdn.example/public/${currentBucket}/${path}` } };
    },
    list(prefix, options) {
      bucket.listCalls.push([prefix, options]);
      return Promise.resolve(bucket.listResponse);
    },
    createSignedUrl(path, expiresInSeconds) {
      bucket.createSignedUrlCalls.push([path, expiresInSeconds]);
      return Promise.resolve(bucket.signedUrlResponse);
    },
  };
  return {
    fromCalls,
    bucket,
    storage: {
      from(bucketName) {
        currentBucket = bucketName;
        fromCalls.push(bucketName);
        return bucket;
      },
    },
  };
}

export function mockSupabaseModule(params: {
  calls: CreateClientCall[];
  supabase: SupabaseClientStub;
}): void {
  void mock.module('@supabase/supabase-js', () => ({
    createClient(url: string, anonKey: string, options: unknown) {
      params.calls.push({ url, anonKey, options });
      return params.supabase;
    },
  }));
}
