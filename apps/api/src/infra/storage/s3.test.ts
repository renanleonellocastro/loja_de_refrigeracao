import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { describe, expect, it } from 'vitest';
import { createStorage, s3SettingsOf } from './factory.js';
import { createS3Client, createS3Storage, type S3Sender } from './s3.js';
import { InvalidStorageKeyError } from './storage.js';

type Command = {
  input: { Bucket?: string; Key?: string; Body?: Buffer; Prefix?: string; ContinuationToken?: string };
};

/** An in memory bucket that answers the SDK commands like S3 does, two keys per listing page. */
class FakeBucket {
  readonly objects = new Map<string, Buffer>();
  readonly buckets = new Set<string>();
  failure?: Error;

  send = (async (command: Command) => {
    this.buckets.add(command.input.Bucket!);
    if (this.failure) throw this.failure;
    return this.answer(command);
  }) as unknown as S3Sender['send'];

  private answer(command: Command) {
    const { Key, Body, Prefix, ContinuationToken } = command.input;
    if (command instanceof PutObjectCommand) return this.objects.set(Key!, Body!) && {};
    if (command instanceof GetObjectCommand) return this.read(Key!);
    if (command instanceof ListObjectsV2Command) return this.list(Prefix!, Number(ContinuationToken ?? 0));
    if (command instanceof DeleteObjectCommand) return this.objects.delete(Key!) && {};
    throw new Error('unexpected command');
  }

  private read(key: string) {
    const data = this.objects.get(key);
    if (!data) throw Object.assign(new Error('missing'), { name: 'NoSuchKey' });
    return { Body: { transformToByteArray: async () => new Uint8Array(data) } };
  }

  private list(prefix: string, start: number) {
    const keys = [...this.objects.keys()].filter((key) => key.startsWith(prefix));
    const page = keys.slice(start, start + 2).map((Key) => ({ Key }));
    const more = start + 2 < keys.length;
    return {
      Contents: page.length > 0 ? page : undefined,
      IsTruncated: more,
      NextContinuationToken: String(start + 2),
    };
  }
}

describe('S3 compatible storage', () => {
  it('stores, reads and removes a key with everything under it', async () => {
    const bucket = new FakeBucket();
    const storage = createS3Storage(bucket, 'fotos');
    for (const file of ['a.webp', 'b.webp', 'c.avif']) await storage.put(`abc/${file}`, Buffer.from(file));
    await storage.put('abcd/a.webp', Buffer.from('other'));
    expect((await storage.get('abc/b.webp'))?.toString()).toBe('b.webp');
    await storage.remove('abc');
    expect([...bucket.objects.keys()]).toEqual(['abcd/a.webp']);
    await storage.remove('empty');
    expect(bucket.buckets).toEqual(new Set(['fotos']));
  });

  it('answers null for missing objects, also when the service only says 404', async () => {
    const bucket = new FakeBucket();
    const storage = createS3Storage(bucket, 'fotos');
    expect(await storage.get('missing.webp')).toBeNull();
    bucket.failure = Object.assign(new Error('not found'), {
      name: 'NotFound',
      $metadata: { httpStatusCode: 404 },
    });
    expect(await storage.get('missing.webp')).toBeNull();
  });

  it('propagates other failures', async () => {
    const bucket = new FakeBucket();
    bucket.failure = Object.assign(new Error('denied'), {
      name: 'AccessDenied',
      $metadata: { httpStatusCode: 403 },
    });
    await expect(createS3Storage(bucket, 'fotos').get('a.webp')).rejects.toThrow('denied');
  });

  it('refuses unsafe keys before calling the service', async () => {
    const bucket = new FakeBucket();
    const storage = createS3Storage(bucket, 'fotos');
    await expect(storage.put('../x', Buffer.from('x'))).rejects.toBeInstanceOf(InvalidStorageKeyError);
    await expect(storage.get('Upper.webp')).rejects.toBeInstanceOf(InvalidStorageKeyError);
    await expect(storage.remove('/abs')).rejects.toBeInstanceOf(InvalidStorageKeyError);
    expect(bucket.buckets.size).toBe(0);
  });
});

describe('storage factory', () => {
  const s3Config = {
    STORAGE_DRIVER: 's3' as const,
    STORAGE_PATH: './storage',
    S3_BUCKET: 'fotos',
    S3_REGION: 'auto',
    S3_ENDPOINT: 'http://localhost:9000',
    S3_FORCE_PATH_STYLE: true,
    S3_ACCESS_KEY_ID: 'id',
    S3_SECRET_ACCESS_KEY: 'secret',
  };

  it('maps the configuration to S3 settings', () => {
    expect(s3SettingsOf(s3Config)).toEqual({
      bucket: 'fotos',
      region: 'auto',
      endpoint: 'http://localhost:9000',
      forcePathStyle: true,
      credentials: { accessKeyId: 'id', secretAccessKey: 'secret' },
    });
    expect(s3SettingsOf({ ...s3Config, S3_ACCESS_KEY_ID: undefined }).credentials).toBeUndefined();
  });

  it('builds an SDK client for the service without contacting it', async () => {
    const client = createS3Client(s3SettingsOf(s3Config));
    expect(client).toBeInstanceOf(S3Client);
    expect(await client.config.forcePathStyle).toBe(true);
    expect(createStorage(s3Config)).toHaveProperty('put');
    expect(createStorage({ ...s3Config, STORAGE_DRIVER: 'local' })).toHaveProperty('put');
  });
});
