import type { Config } from '../../config.js';
import { createS3Client, createS3Storage, type S3Settings } from './s3.js';
import { createLocalStorage, type Storage } from './storage.js';

type StorageConfig = Pick<
  Config,
  | 'STORAGE_DRIVER'
  | 'STORAGE_PATH'
  | 'S3_BUCKET'
  | 'S3_REGION'
  | 'S3_ENDPOINT'
  | 'S3_FORCE_PATH_STYLE'
  | 'S3_ACCESS_KEY_ID'
  | 'S3_SECRET_ACCESS_KEY'
>;

function credentialsOf(config: StorageConfig): S3Settings['credentials'] {
  if (!config.S3_ACCESS_KEY_ID || !config.S3_SECRET_ACCESS_KEY) return undefined;
  return { accessKeyId: config.S3_ACCESS_KEY_ID, secretAccessKey: config.S3_SECRET_ACCESS_KEY };
}

export function s3SettingsOf(config: StorageConfig): S3Settings {
  return {
    bucket: config.S3_BUCKET!,
    region: config.S3_REGION,
    endpoint: config.S3_ENDPOINT,
    forcePathStyle: config.S3_FORCE_PATH_STYLE,
    credentials: credentialsOf(config),
  };
}

/** The adapter chosen by STORAGE_DRIVER (ADR 0010); the configuration was validated by loadConfig. */
export function createStorage(config: StorageConfig): Storage {
  if (config.STORAGE_DRIVER === 'local') return createLocalStorage(config.STORAGE_PATH);
  const settings = s3SettingsOf(config);
  return createS3Storage(createS3Client(settings), settings.bucket);
}
