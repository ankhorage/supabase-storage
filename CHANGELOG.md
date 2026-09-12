# @ankhorage/supabase-storage

## 0.2.7

### Patch Changes

- 9a50bc6: Use package metadata as the default Paradox documentation title and description.

## 0.2.6

### Patch Changes

- 7a87456: Update Ankhorage dependencies: `@ankhorage/contracts`.
- 8290872: Update Ankhorage dependencies: `@ankhorage/contracts`.

## 0.2.5

### Patch Changes

- 5f051fc: Update Ankhorage dependencies: `@ankhorage/contracts`.

## 0.2.4

### Patch Changes

- c4d31bb: Update Ankhorage dependencies: `@ankhorage/contracts`.

## 0.2.3

### Patch Changes

- afdcd31: Update Ankhorage dependencies: `@ankhorage/contracts`.

## 0.2.2

### Patch Changes

- 646f694: Update Ankhorage dependencies: `@ankhorage/contracts`.

## 0.2.1

### Patch Changes

- a0205a9: Update Ankhorage dependencies: `@ankhorage/contracts`, `@ankhorage/paradox`.
- 9b0b22a: Update Ankhorage dependencies: `@ankhorage/contracts`.

## 0.2.0

### Minor Changes

- dc94ac5: Add Supabase object listing and signed URL operations plus an optional `@ankhorage/contracts` bridge that implements the canonical `MediaStorageAdapter` for app-authoring media.

## 0.1.1

### Patch Changes

- 9aaac0a: Update packages

## 0.1.0

### Minor Changes

- ec11c91: Implement the standalone Supabase Storage adapter.

  This adds a type-safe `createSupabaseStorageAdapter` factory with `upload`, `remove`, `publicUrl`, and `getPublicUrl` methods. Adapter methods return normalized Result objects for expected failures, keep upload bodies runtime-neutral with `Uint8Array`, and avoid exposing DOM-specific public types.

  The package also adds mocked Supabase Storage tests, standalone usage documentation, and provider-neutral error/result normalization for invalid config, validation errors, provider errors, and thrown client failures.
