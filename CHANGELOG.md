# @ankhorage/supabase-storage

## 0.1.0

### Minor Changes

- ec11c91: Implement the standalone Supabase Storage adapter.

  This adds a type-safe `createSupabaseStorageAdapter` factory with `upload`, `remove`, `publicUrl`, and `getPublicUrl` methods. Adapter methods return normalized Result objects for expected failures, keep upload bodies runtime-neutral with `Uint8Array`, and avoid exposing DOM-specific public types.

  The package also adds mocked Supabase Storage tests, standalone usage documentation, and provider-neutral error/result normalization for invalid config, validation errors, provider errors, and thrown client failures.
