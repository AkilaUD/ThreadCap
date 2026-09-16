import { StorageError, StorageProvider, AttachAction } from './index.js';

export interface S3ClientLike {
  send(command: unknown): Promise<unknown>;
  putObject?(input: unknown): Promise<unknown>;
}

export interface S3ProviderOptions {
  endpoint?: string;
  bucket: string;
  region: string;
  publicBaseUrl?: string;
  /** lazily load `@aws-sdk/client-s3` (optional peer @aws-sdk/client-s3) */
  lazyDeps?: {
    client: new (cfg: {
      endpoint?: string;
      region: string;
      forcePathStyle?: boolean;
      credentials?: unknown;
    }) => S3ClientLike;
    PutObjectCommand: new (input: { Bucket: string; Key: string; Body: Uint8Array }) => unknown;
    DeleteObjectCommand: new (input: { Bucket: string; Key: string }) => unknown;
  };
}

/** S3/R2-backed provider; requires the optional peer `@aws-sdk/client-s3`. */
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

  private client(deps: NonNullable<S3ProviderOptions['lazyDeps']>): S3ClientLike {
    return new deps.client({
      endpoint: this.opts.endpoint,
      region: this.opts.region,
      forcePathStyle: Boolean(this.opts.endpoint),
    });
  }

  async put(key: string, body: Uint8Array): Promise<void> {
    const deps = await this.s3();
    const s3 = this.client(deps);
    await s3.send(new deps.PutObjectCommand({ Bucket: this.opts.bucket, Key: key, Body: body }));
  }

  async getSignedUrl(_key: string, _action: AttachAction, _ttlSec: number): Promise<string> {
    throw new StorageError('presigned URLs require an AWS credentials session; TODO', 'not-supported');
  }

  async delete(key: string): Promise<void> {
    const deps = await this.s3();
    const s3 = this.client(deps);
    await s3.send(new deps.DeleteObjectCommand({ Bucket: this.opts.bucket, Key: key }));
  }
}