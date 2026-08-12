# Public API

## AssetMetadata

Kind: `type`
Module: `src/types.ts`
Source: `src/types.ts:56:1`

### Members

| Name         | Kind     | Type             | Required | Description |
| ------------ | -------- | ---------------- | -------- | ----------- |
| bucket       | property | `string`         | yes      |             |
| cacheControl | property | `string \| null` | yes      |             |
| contentType  | property | `string \| null` | yes      |             |
| path         | property | `string`         | yes      |             |
| publicUrl    | property | `string`         | yes      |             |
| size         | property | `number`         | yes      |             |

## createSupabaseStorageAdapter

Kind: `function`
Module: `src/createSupabaseStorageAdapter.ts`
Source: `src/createSupabaseStorageAdapter.ts:31:1`

### Signatures

- `(config: SupabaseStorageAdapterConfig) => SupabaseStorageAdapter`
  - config: `SupabaseStorageAdapterConfig`
  - returns: `SupabaseStorageAdapter`

## ListedAssetMetadata

Kind: `type`
Module: `src/types.ts`
Source: `src/types.ts:65:1`

### Members

| Name        | Kind     | Type             | Required | Description |
| ----------- | -------- | ---------------- | -------- | ----------- |
| bucket      | property | `string`         | yes      |             |
| contentType | property | `string \| null` | yes      |             |
| createdAt   | property | `string \| null` | yes      |             |
| etag        | property | `string \| null` | yes      |             |
| path        | property | `string`         | yes      |             |
| size        | property | `number \| null` | yes      |             |
| updatedAt   | property | `string \| null` | yes      |             |

## ListInput

Kind: `type`
Module: `src/types.ts`
Source: `src/types.ts:43:1`

### Members

| Name   | Kind     | Type                  | Required | Description |
| ------ | -------- | --------------------- | -------- | ----------- |
| bucket | property | `string \| undefined` | no       |             |
| cursor | property | `string \| undefined` | no       |             |
| limit  | property | `number \| undefined` | no       |             |
| prefix | property | `string \| undefined` | no       |             |

## ListResult

Kind: `type`
Module: `src/types.ts`
Source: `src/types.ts:90:1`

### Members

| Name       | Kind     | Type                             | Required | Description |
| ---------- | -------- | -------------------------------- | -------- | ----------- |
| assets     | property | `readonly ListedAssetMetadata[]` | yes      |             |
| nextCursor | property | `string \| undefined`            | no       |             |

## PublicUrlInput

Kind: `type`
Module: `src/types.ts`
Source: `src/types.ts:38:1`

### Members

| Name   | Kind     | Type                  | Required | Description |
| ------ | -------- | --------------------- | -------- | ----------- |
| bucket | property | `string \| undefined` | no       |             |
| path   | property | `string`              | yes      |             |

## PublicUrlResult

Kind: `type`
Module: `src/types.ts`
Source: `src/types.ts:86:1`

### Members

| Name  | Kind     | Type                                                     | Required | Description |
| ----- | -------- | -------------------------------------------------------- | -------- | ----------- |
| asset | property | `Pick<AssetMetadata, "bucket" \| "path" \| "publicUrl">` | yes      |             |

## RemoveInput

Kind: `type`
Module: `src/types.ts`
Source: `src/types.ts:33:1`

### Members

| Name   | Kind     | Type                  | Required | Description |
| ------ | -------- | --------------------- | -------- | ----------- |
| bucket | property | `string \| undefined` | no       |             |
| path   | property | `string`              | yes      |             |

## RemoveResult

Kind: `type`
Module: `src/types.ts`
Source: `src/types.ts:79:1`

### Members

| Name    | Kind     | Type                                | Required | Description |
| ------- | -------- | ----------------------------------- | -------- | ----------- |
| removed | property | `{ bucket: string; path: string; }` | yes      |             |

## SignedUrlInput

Kind: `type`
Module: `src/types.ts`
Source: `src/types.ts:50:1`

### Members

| Name             | Kind     | Type                  | Required | Description |
| ---------------- | -------- | --------------------- | -------- | ----------- |
| bucket           | property | `string \| undefined` | no       |             |
| expiresInSeconds | property | `number`              | yes      |             |
| path             | property | `string`              | yes      |             |

## SignedUrlResult

Kind: `type`
Module: `src/types.ts`
Source: `src/types.ts:95:1`

### Members

| Name  | Kind     | Type                                                   | Required | Description |
| ----- | -------- | ------------------------------------------------------ | -------- | ----------- |
| asset | property | `{ bucket: string; path: string; signedUrl: string; }` | yes      |             |

## StorageAdapterError

Kind: `type`
Module: `src/types.ts`
Source: `src/types.ts:10:1`

### Members

| Name    | Kind     | Type                      | Required | Description |
| ------- | -------- | ------------------------- | -------- | ----------- |
| cause   | property | `unknown`                 | no       |             |
| code    | property | `StorageAdapterErrorCode` | yes      |             |
| message | property | `string`                  | yes      |             |

## StorageAdapterErrorCode

Kind: `unknown`
Module: `src/types.ts`
Source: `src/types.ts:3:1`

## StorageResult

Kind: `unknown`
Module: `src/types.ts`
Source: `src/types.ts:1:1`

## SupabaseStorageAdapter

Kind: `type`
Module: `src/types.ts`
Source: `src/types.ts:103:1`

### Members

| Name            | Kind   | Type                                                                 | Required | Description |
| --------------- | ------ | -------------------------------------------------------------------- | -------- | ----------- |
| createSignedUrl | method | `(input: SignedUrlInput) => Promise<StorageResult<SignedUrlResult>>` | yes      |             |
| getPublicUrl    | method | `(input: PublicUrlInput) => Promise<StorageResult<PublicUrlResult>>` | yes      |             |
| list            | method | `(input: ListInput) => Promise<StorageResult<ListResult>>`           | yes      |             |
| publicUrl       | method | `(input: PublicUrlInput) => Promise<StorageResult<PublicUrlResult>>` | yes      |             |
| remove          | method | `(input: RemoveInput) => Promise<StorageResult<RemoveResult>>`       | yes      |             |
| upload          | method | `(input: UploadInput) => Promise<StorageResult<UploadResult>>`       | yes      |             |

## SupabaseStorageAdapterConfig

Kind: `type`
Module: `src/types.ts`
Source: `src/types.ts:16:1`

### Members

| Name    | Kind     | Type                  | Required | Description |
| ------- | -------- | --------------------- | -------- | ----------- |
| anonKey | property | `string`              | yes      |             |
| bucket  | property | `string \| undefined` | no       |             |
| url     | property | `string`              | yes      |             |

## UploadBody

Kind: `unknown`
Module: `src/types.ts`
Source: `src/types.ts:22:1`

## UploadInput

Kind: `type`
Module: `src/types.ts`
Source: `src/types.ts:24:1`

### Members

| Name         | Kind     | Type                   | Required | Description |
| ------------ | -------- | ---------------------- | -------- | ----------- |
| body         | property | `Uint8Array`           | yes      |             |
| bucket       | property | `string \| undefined`  | no       |             |
| cacheControl | property | `string \| undefined`  | no       |             |
| contentType  | property | `string \| undefined`  | no       |             |
| path         | property | `string`               | yes      |             |
| upsert       | property | `boolean \| undefined` | no       |             |

## UploadResult

Kind: `type`
Module: `src/types.ts`
Source: `src/types.ts:75:1`

### Members

| Name  | Kind     | Type            | Required | Description |
| ----- | -------- | --------------- | -------- | ----------- |
| asset | property | `AssetMetadata` | yes      |             |
