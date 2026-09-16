import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AttachAction, StorageError, StorageProvider } from './index.js';

export interface LocalDiskProviderOptions {
  baseDir: string;
  publicBaseUrl?: string;
}

/**
 * Keys: `attachments/{workspace_id}/{att_ulid}/{filename}` (docs/02-data-model.md §7).
 * Path-traversal is rejected before any fs call.
 */
export class LocalDiskProvider implements StorageProvider {
  constructor(private readonly opts: LocalDiskProviderOptions) {}

  private resolve(key: string): string {
    if (!key || key.includes('..') || key.includes('\\')) {
      throw new StorageError(`invalid storage key: ${key}`, 'key-invalid');
    }
    const abs = path.resolve(this.opts.baseDir, key);
    if (!abs.startsWith(path.resolve(this.opts.baseDir))) {
      throw new StorageError(`key escapes base directory: ${key}`, 'key-invalid');
    }
    return abs;
  }

  async put(key: string, body: Uint8Array | NodeJS.ReadableStream): Promise<void> {
    const abs = this.resolve(key);
    await mkdir(path.dirname(abs), { recursive: true });
    if (body instanceof Uint8Array) {
      await writeFile(abs, body);
      return;
    }
    await new Promise<void>((res, rej) => {
      const out = createWriteStream(abs);
      body.on('data', (chunk: Buffer) => out.write(chunk));
      body.on('end', () => out.end(() => res()));
      body.on('error', rej);
      out.on('error', rej);
    });
  }

  /** Signed URLs are returned as public URLs for the local-disk provider (no presign). */
  async getSignedUrl(key: string, _action: AttachAction, _ttlSec: number): Promise<string> {
    const abs = this.resolve(key);
    if (!this.opts.publicBaseUrl) {
      throw new StorageError('LocalDiskProvider.getSignedUrl requires publicBaseUrl', 'not-supported');
    }
    const rel = path.relative(path.resolve(this.opts.baseDir), abs).replaceAll('\\', '/');
    return `${this.opts.publicBaseUrl}/${rel}`;
  }

  async delete(key: string): Promise<void> {
    const abs = this.resolve(key);
    await rm(abs, { force: true });
  }

  /** Non-interface helper for tests/scripts. */
  async read(key: string): Promise<Buffer> {
    return readFile(this.resolve(key));
  }
}