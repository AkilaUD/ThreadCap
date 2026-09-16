export const AttachAction = { Read: 'read', Write: 'write' } as const;
export type AttachAction = (typeof AttachAction)[keyof typeof AttachAction];

/**
 * Storage abstraction (docs/02-data-model.md §7).
 * MVP: LocalDiskProvider on the Railway volume; S3Provider later — swap is env-only.
 */
export interface StorageProvider {
  put(key: string, body: Uint8Array | NodeJS.ReadableStream): Promise<void>;
  getSignedUrl(key: string, action: AttachAction, ttlSec: number): Promise<string>;
  delete(key: string): Promise<void>;
}

export class StorageError extends Error {
  constructor(
    message: string,
    readonly code: 'key-invalid' | 'not-supported' | 'io',
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

export { LocalDiskProvider } from './local.js';
export type { LocalDiskProviderOptions } from './local.js';
export { S3Provider } from './s3.js';
export type { S3ProviderOptions } from './s3.js';