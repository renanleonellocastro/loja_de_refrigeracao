import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  type ListObjectsV2CommandOutput,
} from '@aws-sdk/client-s3';
import { assertSafeKey, type Storage } from './storage.js';

/** Settings of any S3 compatible service: AWS S3, Cloudflare R2, Oracle Object Storage, MinIO and others. */
export interface S3Settings {
  bucket: string;
  region: string;
  /** Empty for AWS itself; the service URL for everything else, for example http://localhost:9000. */
  endpoint?: string;
  /** Most services other than AWS need bucket names in the path instead of the host name. */
  forcePathStyle: boolean;
  /** Without keys the SDK uses its default chain (environment, instance role). */
  credentials?: { accessKeyId: string; secretAccessKey: string };
}

/** The one method of the SDK client the adapter uses, so tests can answer without network. */
export type S3Sender = Pick<S3Client, 'send'>;

export function createS3Client(settings: S3Settings): S3Client {
  return new S3Client({
    region: settings.region,
    endpoint: settings.endpoint,
    forcePathStyle: settings.forcePathStyle,
    credentials: settings.credentials,
    // Several compatible services reject the newer default checksums; send them only when an operation requires.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
}

function isMissingObject(error: unknown): boolean {
  const failure = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return failure.name === 'NoSuchKey' || failure.$metadata?.httpStatusCode === 404;
}

async function readObject(client: S3Sender, bucket: string, key: string): Promise<Buffer | null> {
  try {
    const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    return Buffer.from(await response.Body!.transformToByteArray());
  } catch (error) {
    if (isMissingObject(error)) return null;
    throw error;
  }
}

function listPage(client: S3Sender, bucket: string, prefix: string, token?: string) {
  return client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }));
}

function keysOf(page: ListObjectsV2CommandOutput): string[] {
  return (page.Contents ?? []).map((object) => object.Key!);
}

/** Every key under `prefix/`, following the pages of the listing. */
async function keysUnder(client: S3Sender, bucket: string, prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const page = await listPage(client, bucket, `${prefix}/`, token);
    keys.push(...keysOf(page));
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

/** Deletes one object at a time: a photo has few files, and DeleteObjects is not supported everywhere. */
async function removeTree(client: S3Sender, bucket: string, prefix: string): Promise<void> {
  const keys = [prefix, ...(await keysUnder(client, bucket, prefix))];
  await Promise.all(keys.map((key) => client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))));
}

export function createS3Storage(client: S3Sender, bucket: string): Storage {
  return {
    put: async (key, data) => {
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: assertSafeKey(key), Body: data }));
    },
    get: async (key) => readObject(client, bucket, assertSafeKey(key)),
    remove: async (prefix) => removeTree(client, bucket, assertSafeKey(prefix)),
  };
}
