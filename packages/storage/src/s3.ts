import type { PutObjectCommandInput } from '@aws-sdk/client-s3';
import { StorageError, StorageProvider, AttachAction } from './index.js';

export interface S3ProviderOptions {
  endpoint?: string;
  bucket: string;
  region: string;
  publicBaseUrl?: string;
  /** lazily load `@aws-sdk/client-s3` (optional peer dep) */
  lazyDeps?: {
    client: {
      new (cfg: {
        endpoint?: string;
        region: string;
        forcePathStyle?: boolean;
        credentials?: unknown;
      }): unknown;
      prototype: {
        send: Function;
      };
    };
    PutObjectCommand: new (input: PutObjectCommandInput) => unknown;
    DeleteObjectCommand: new (input: { Bucket: string; Key: string }) => unknown;
    GetObjectCommand: new (input: { Bucket: string; Key: string }) => unknown;
  };
}

/** S3/R2-backed provider; requires optional peer `@aws-sdk/client-s3`. */
export class S3Provider implements StorageProvider {
  constructor(private readonly opts: S3ProviderOptions) {}

  private async s3(): Promise<NonNullable<S3ProviderOptions['lazyDeps']>> {
    if (!this.opts.lazyDeps) {
      throw new StorageError(
        '@aws-sdk/client-s3 is not installed — install it to use S3Provider (or use LocalDiskProvider)',
        'not-supported',
      );
    }
    return this.opts.lazyDeps;
  }

  async put(key: string, body: Uint8Array): Promise<void> {
    const deps = await this.s3();
    const s3 = new deps.client({
      endpoint: this.opts.endpoint,
      region: this.opts.region,
      forcePathStyle: Boolean(this.opts.endpoint),
    });
    await (s3.send as Function)(new deps.PutObjectCommand({ Bucket: this.opts.bucket, Key: key, Body: body }));
  }

  async getSignedUrl(_key: string, _action: AttachAction, _ttlSec: number): Promise<string> {
    throw new StorageError('presigned URLs require a full AWS session-capable credential path; TODO', 'not-supported');
  }

  async delete(key: string): Promise<void> {
    const deps = await this.s3();
    const s3 = new deps.client({ endpoint: this.opts.endpoint, region: this.opts.region, forcePathStyle: Boolean(this.opts.endpoint) });
    await (s3.send as Function)(new deps.DeleteObjectCommand({ Bucket: this.opts.bucket, Key: key }));
  }
}