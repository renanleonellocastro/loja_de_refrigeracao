/** Answer of an upload: the status and the parsed JSON body (null when the body is not JSON). */
export interface UploadResult {
  status: number;
  body: unknown;
}

/**
 * Sends a multipart form with XMLHttpRequest, the only browser API that reports upload progress.
 * `onProgress` receives 0 to 100. A dropped connection rejects; any HTTP answer resolves.
 */
export function uploadWithProgress(
  url: string,
  form: FormData,
  token: string | null,
  onProgress: (percent: number) => void,
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', url);
    if (token) request.setRequestHeader('authorization', `Bearer ${token}`);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      let body: unknown;
      try {
        body = JSON.parse(request.responseText);
      } catch {
        body = null;
      }
      resolve({ status: request.status, body });
    };
    request.onerror = () => reject(new Error('network'));
    request.send(form);
  });
}
