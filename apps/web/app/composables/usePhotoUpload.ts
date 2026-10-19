import type { Ref } from 'vue';
import { useAuthStore } from '~/stores/auth';
import { problemToError } from '~/utils/api-error';
import { uploadWithProgress } from '~/utils/upload';

const UPLOAD_CREATED = 201;

function photosForm(files: readonly File[]): FormData {
  const form = new FormData();
  for (const file of files) form.append('files', file, file.name);
  return form;
}

async function sendWithProgress<Body>(
  url: string,
  files: readonly File[],
  token: string | null,
  progress: Ref<number | null>,
): Promise<Body> {
  progress.value = 0;
  try {
    const onProgress = (percent: number) => (progress.value = percent);
    const result = await uploadWithProgress(url, photosForm(files), token, onProgress);
    if (result.status !== UPLOAD_CREATED) throw problemToError(result.status, result.body);
    return result.body as Body;
  } finally {
    progress.value = null;
  }
}

/**
 * Multipart photo upload to an API path with its progress (0 to 100, null when idle). `send` answers the
 * parsed body of the 201 and throws an ApiError for any other answer or a dropped connection.
 */
export function usePhotoUpload() {
  const config = useRuntimeConfig();
  const auth = useAuthStore();
  const progress = ref<number | null>(null);
  const send = <Body>(path: string, files: readonly File[]) =>
    sendWithProgress<Body>(`${config.public.apiBase}${path}`, files, auth.accessToken, progress);
  return { progress, send };
}
