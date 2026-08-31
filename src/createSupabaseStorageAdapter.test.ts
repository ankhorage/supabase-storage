import { expect, it } from 'bun:test';

import {
  type CreateClientCall,
  createSupabaseClientStub,
  mockSupabaseModule,
} from './createSupabaseStorageAdapter.testSupport.js';
import type { SupabaseStorageAdapter } from './types.js';

it('does not throw on invalid config; methods return invalid_config', async () => {
  const calls: CreateClientCall[] = [];
  const supabase = createSupabaseClientStub();
  mockSupabaseModule({ calls, supabase });

  const { createSupabaseStorageAdapter } = await import('./createSupabaseStorageAdapter.js');

  const adapter: SupabaseStorageAdapter = createSupabaseStorageAdapter({ url: '', anonKey: '' });

  const upload = await adapter.upload({ path: 'a.txt', body: new Uint8Array([1]) });
  expect(upload).toEqual({
    ok: false,
    error: { code: 'invalid_config', message: 'Supabase Storage URL is required.' },
  });

  const remove = await adapter.remove({ path: 'a.txt' });
  expect(remove).toEqual({
    ok: false,
    error: { code: 'invalid_config', message: 'Supabase Storage URL is required.' },
  });

  const url = await adapter.publicUrl({ path: 'a.txt' });
  expect(url).toEqual({
    ok: false,
    error: { code: 'invalid_config', message: 'Supabase Storage URL is required.' },
  });

  const list = await adapter.list({});
  expect(list).toEqual({
    ok: false,
    error: { code: 'invalid_config', message: 'Supabase Storage URL is required.' },
  });

  expect(calls).toHaveLength(0);
});

it('normalizes upload calls and returns stable metadata', async () => {
  const calls: CreateClientCall[] = [];
  const supabase = createSupabaseClientStub();
  mockSupabaseModule({ calls, supabase });

  const { createSupabaseStorageAdapter } = await import('./createSupabaseStorageAdapter.js');

  const adapter = createSupabaseStorageAdapter({
    url: 'https://example.supabase.co/',
    anonKey: 'anon',
    bucket: 'default-bucket',
  });

  const body = new Uint8Array([1, 2, 3, 4]);
  const result = await adapter.upload({
    path: '/folder/file.txt',
    body,
    contentType: 'text/plain',
    cacheControl: '3600',
    upsert: true,
  });

  expect(result).toEqual({
    ok: true,
    data: {
      asset: {
        bucket: 'default-bucket',
        path: 'folder/file.txt',
        publicUrl: 'https://cdn.example/public/default-bucket/folder/file.txt',
        contentType: 'text/plain',
        cacheControl: '3600',
        size: 4,
      },
    },
  });

  expect(calls).toEqual([
    {
      url: 'https://example.supabase.co',
      anonKey: 'anon',
      options: {
        auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      },
    },
  ]);

  expect(supabase.fromCalls).toEqual(['default-bucket', 'default-bucket']);
  expect(supabase.bucket.uploadCalls).toEqual([
    ['folder/file.txt', body, { contentType: 'text/plain', upsert: true, cacheControl: '3600' }],
  ]);
  expect(supabase.bucket.getPublicUrlCalls).toEqual([['folder/file.txt']]);
});

it('normalizes publicUrl and getPublicUrl alias', async () => {
  const calls: CreateClientCall[] = [];
  const supabase = createSupabaseClientStub();
  mockSupabaseModule({ calls, supabase });

  const { createSupabaseStorageAdapter } = await import('./createSupabaseStorageAdapter.js');

  const adapter = createSupabaseStorageAdapter({
    url: 'https://example.supabase.co',
    anonKey: 'anon',
    bucket: 'bucket-1',
  });

  const a = await adapter.publicUrl({ path: '/x/y.txt' });
  const b = await adapter.getPublicUrl({ path: '/x/y.txt' });

  expect(a).toEqual(b);
  expect(a).toEqual({
    ok: true,
    data: {
      asset: {
        bucket: 'bucket-1',
        path: 'x/y.txt',
        publicUrl: 'https://cdn.example/public/bucket-1/x/y.txt',
      },
    },
  });

  expect(supabase.bucket.getPublicUrlCalls).toEqual([['x/y.txt'], ['x/y.txt']]);
});

it('normalizes remove calls', async () => {
  const calls: CreateClientCall[] = [];
  const supabase = createSupabaseClientStub();
  mockSupabaseModule({ calls, supabase });

  const { createSupabaseStorageAdapter } = await import('./createSupabaseStorageAdapter.js');

  const adapter = createSupabaseStorageAdapter({
    url: 'https://example.supabase.co',
    anonKey: 'anon',
    bucket: 'bucket-1',
  });

  const result = await adapter.remove({ path: '/a/b/c.png' });

  expect(result).toEqual({
    ok: true,
    data: {
      removed: { bucket: 'bucket-1', path: 'a/b/c.png' },
    },
  });
  expect(supabase.bucket.removeCalls).toEqual([[['a/b/c.png']]]);
});

it('lists normalized file metadata with opaque offset cursors', async () => {
  const calls: CreateClientCall[] = [];
  const supabase = createSupabaseClientStub();
  supabase.bucket.listResponse = {
    data: [
      {
        id: 'file-1',
        name: 'hero.png',
        created_at: '2026-08-12T07:00:00.000Z',
        updated_at: '2026-08-12T07:01:00.000Z',
        metadata: { mimetype: 'image/png', size: 4096, eTag: 'etag-1' },
      },
      { id: null, name: 'nested', created_at: null, updated_at: null, metadata: null },
    ],
    error: null,
  };
  mockSupabaseModule({ calls, supabase });

  const { createSupabaseStorageAdapter } = await import('./createSupabaseStorageAdapter.js');
  const adapter = createSupabaseStorageAdapter({
    url: 'https://example.supabase.co',
    anonKey: 'anon',
    bucket: 'media',
  });

  const result = await adapter.list({ prefix: '/authoring/', cursor: '4', limit: 2 });

  expect(result).toEqual({
    ok: true,
    data: {
      assets: [
        {
          bucket: 'media',
          path: 'authoring/hero.png',
          contentType: 'image/png',
          size: 4096,
          createdAt: '2026-08-12T07:00:00.000Z',
          updatedAt: '2026-08-12T07:01:00.000Z',
          etag: 'etag-1',
        },
      ],
      nextCursor: '6',
    },
  });
  expect(supabase.bucket.listCalls).toEqual([
    ['authoring', { limit: 2, offset: 4, sortBy: { column: 'name', order: 'asc' } }],
  ]);
});

it('creates signed URLs with validated expiry', async () => {
  const calls: CreateClientCall[] = [];
  const supabase = createSupabaseClientStub();
  mockSupabaseModule({ calls, supabase });

  const { createSupabaseStorageAdapter } = await import('./createSupabaseStorageAdapter.js');
  const adapter = createSupabaseStorageAdapter({
    url: 'https://example.supabase.co',
    anonKey: 'anon',
    bucket: 'media',
  });

  const result = await adapter.createSignedUrl({ path: '/hero.png', expiresInSeconds: 600 });

  expect(result).toEqual({
    ok: true,
    data: {
      asset: {
        bucket: 'media',
        path: 'hero.png',
        signedUrl: 'https://signed.example/hero.png',
      },
    },
  });
  expect(supabase.bucket.createSignedUrlCalls).toEqual([['hero.png', 600]]);
});

it('normalizes provider errors and thrown errors', async () => {
  const calls: CreateClientCall[] = [];
  const supabase = createSupabaseClientStub();
  supabase.bucket.uploadResponse = { data: null, error: { message: 'upload failed' } };
  supabase.bucket.removeThrows = new Error('boom');
  mockSupabaseModule({ calls, supabase });

  const { createSupabaseStorageAdapter } = await import('./createSupabaseStorageAdapter.js');

  const adapter = createSupabaseStorageAdapter({
    url: 'https://example.supabase.co',
    anonKey: 'anon',
    bucket: 'bucket-1',
  });

  const upload = await adapter.upload({ path: 'a.txt', body: new Uint8Array([1]) });
  expect(upload).toEqual({
    ok: false,
    error: {
      code: 'provider_error',
      message: 'upload failed',
      cause: { operation: 'upload', error: { message: 'upload failed' } },
    },
  });

  const remove = await adapter.remove({ path: 'a.txt' });
  expect(remove.ok).toBe(false);
  if (!remove.ok) {
    expect(remove.error.code).toBe('network_error');
    expect(remove.error.message).toBe('Unable to reach Supabase Storage.');
  }
});
