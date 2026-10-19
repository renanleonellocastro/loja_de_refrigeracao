/** Answer of an upload: the status and the parsed JSON body (null when the body is not JSON). */
export interface UploadResult {
  status: number;
  body: unknown;
}

const FULL_PERCENT = 100;

/** The parsed JSON body of an answer, or null when the body is not JSON. */
function parseJsonBody(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function progressReporter(onProgress: (percent: number) => void): (event: ProgressEvent) => void {
  return (event) => {
    if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * FULL_PERCENT));
  };
}

function openUploadRequest(url: string, token: string | null): XMLHttpRequest {
  const request = new XMLHttpRequest();
  request.open('POST', url);
  if (token) request.setRequestHeader('authorization', `Bearer ${token}`);
  return request;
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
    const request = openUploadRequest(url, token);
    request.upload.onprogress = progressReporter(onProgress);
    request.onload = () => resolve({ status: request.status, body: parseJsonBody(request.responseText) });
    request.onerror = () => reject(new Error('network'));
    request.send(form);
  });
}
