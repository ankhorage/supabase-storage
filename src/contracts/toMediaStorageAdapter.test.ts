import { describe, expect, it } from 'bun:test';

import type { SupabaseStorageAdapter } from '../types.js';
import { toMediaStorageAdapter } from './toMediaStorageAdapter.js';

function createAdapterFixture() {
  const signedUrlCalls: { bucket?: string; path: string; expiresInSeconds: number }[] = [];

  const adapter: SupabaseStorageAdapter = {
    upload(input) {
      return Promise.resolve({
        ok: true,
        data: {
          asset: {
            bucket: input.bucket ?? 'default',
            path: input.path,
            publicUrl: `https://cdn.example/${input.path}`,
            contentType: input.contentType ?? null,
            cacheControl: input.cacheControl ?? null,
            size: input.body.byteLength,
          },
        },
      });
    },
    remove(input) {
      return Promise.resolve({
        ok: true,
        data: { removed: { bucket: input.bucket ?? 'default', path: input.path } },
      });
    },
    publicUrl(input) {
      return Promise.resolve({
        ok: true,
        data: {
          asset: {
            bucket: input.bucket ?? 'default',
            path: input.path,
            publicUrl: `https://cdn.example/${input.path}`,
          },
        },
      });
    },
    getPublicUrl(input) {
      return adapter.publicUrl(input);
    },
    list(input) {
      return Promise.resolve({
        ok: true,
        data: {
          assets: [
            {
              bucket: input.bucket ?? 'default',
              path: 'authoring/hero.png',
              contentType: 'image/png',
              size: 4096,
              createdAt: '2026-08-12T07:00:00.000Z',
              updatedAt: null,
              etag: 'etag-1',
            },
          ],
          nextCursor: '100',
        },
      });
    },
    createSignedUrl(input) {
      signedUrlCalls.push(input);
      return Promise.resolve({
        ok: true,
        data: {
          asset: {
            bucket: input.bucket ?? 'default',
            path: input.path,
            signedUrl: `https://signed.example/${input.path}`,
          },
        },
      });
    },
  };

  return { adapter, signedUrlCalls };
}

describe('toMediaStorageAdapter', () => {
  it('persists stable storage identity instead of provider URLs', async () => {
    const { adapter } = createAdapterFixture();
    const media = toMediaStorageAdapter(adapter);

    const result = await media.upload({
      storageId: 'primary',
      bucket: 'media',
      path: 'authoring/hero.png',
      body: new Uint8Array([1, 2, 3]),
      contentType: 'image/png',
    });

    expect(result).toEqual({
      ok: true,
      data: {
        asset: {
          storageId: 'primary',
          bucket: 'media',
          path: 'authoring/hero.png',
        },
      },
    });
  });

  it('maps provider metadata to canonical list metadata', async () => {
    const { adapter } = createAdapterFixture();
    const media = toMediaStorageAdapter(adapter);

    const result = await media.list({ storageId: 'primary', bucket: 'media', prefix: 'authoring' });

    expect(result).toEqual({
      ok: true,
      data: {
        objects: [
          {
            storageId: 'primary',
            bucket: 'media',
            path: 'authoring/hero.png',
            contentType: 'image/png',
            sizeBytes: 4096,
            createdAt: '2026-08-12T07:00:00.000Z',
            etag: 'etag-1',
          },
        ],
        nextCursor: '100',
      },
    });
  });

  it('uses signed resolution by default and public resolution only when requested', async () => {
    const { adapter, signedUrlCalls } = createAdapterFixture();
    const media = toMediaStorageAdapter(adapter);

    const signed = await media.resolve({
      storageId: 'primary',
      bucket: 'media',
      path: 'authoring/hero.png',
    });
    const publicResult = await media.resolve({
      storageId: 'primary',
      bucket: 'media',
      path: 'authoring/hero.png',
      access: 'public',
    });

    expect(signedUrlCalls).toEqual([
      { bucket: 'media', path: 'authoring/hero.png', expiresInSeconds: 900 },
    ]);
    expect(signed).toEqual({
      ok: true,
      data: {
        asset: {
          storageId: 'primary',
          bucket: 'media',
          path: 'authoring/hero.png',
          url: 'https://signed.example/authoring/hero.png',
          access: 'signed',
        },
      },
    });
    expect(publicResult).toEqual({
      ok: true,
      data: {
        asset: {
          storageId: 'primary',
          bucket: 'media',
          path: 'authoring/hero.png',
          url: 'https://cdn.example/authoring/hero.png',
          access: 'public',
        },
      },
    });
  });
});
