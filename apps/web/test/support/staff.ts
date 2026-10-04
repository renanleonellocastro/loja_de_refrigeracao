import { flushPromises } from '@vue/test-utils';
import { vi } from 'vitest';
import { IMAGE } from './shop';

/** Helpers for the staff screens of the catalog, orders and the counter. */

export const ADMIN_USER = {
  id: 1,
  name: 'Eduardo Castro',
  email: 'admin@castro.dev',
  role: 'ADMIN' as const,
};
export const EMPLOYEE_USER = {
  id: 3,
  name: 'Tiago Técnico',
  email: 'tecnico@castro.dev',
  role: 'EMPLOYEE' as const,
};

/** Lets API answers, timers of zero and router navigations finish. */
export async function settle(): Promise<void> {
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await flushPromises();
}

export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
export const text = () => document.body.textContent ?? '';

/** Clicks the element (usually an icon button) with this aria-label. */
export function press(label: string): void {
  const element = document.querySelector<HTMLElement>(`[aria-label="${label}"]`);
  if (!element) throw new Error(`No element labeled ${label}`);
  element.click();
}

export function isDisabled(label: string): boolean {
  return document.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!.disabled;
}

export const paged = (data: unknown[], total = data.length, extra: Record<string, unknown> = {}) => ({
  body: { data, meta: { page: 1, pageSize: 20, total, ...extra } },
});

export const category = (id: number, name: string, productCount = 0, position = id) => ({
  id,
  name,
  position,
  productCount,
});

export const photo = (id: number, isCover = false, position = id) => ({
  ...IMAGE,
  url: `/api/v1/media/${id}/960.webp`,
  id,
  position,
  isCover,
});

export const movement = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  type: 'IN',
  quantity: 5,
  reason: null,
  authorId: 2,
  authorName: 'Marina Gerente',
  orderId: null,
  createdAt: '2026-10-03T15:00:00.000Z',
  ...extra,
});

/** Answer the next XMLHttpRequest uploads get: a status and body, or a dropped connection. */
export type UploadReply = { status: number; body: unknown } | 'error';

/** Replaces XMLHttpRequest so photo uploads report progress and answer without a network. */
export function mockUploads(...replies: UploadReply[]) {
  const sent: Array<{ url: string; form: FormData; headers: Record<string, string> }> = [];
  class FakeRequest {
    upload: { onprogress?: (event: Partial<ProgressEvent>) => void } = {};
    onload?: () => void;
    onerror?: () => void;
    status = 0;
    responseText = '';
    private url = '';
    private headers: Record<string, string> = {};
    open(_method: string, url: string) {
      this.url = url;
    }
    setRequestHeader(name: string, value: string) {
      this.headers[name] = value;
    }
    send(form: FormData) {
      sent.push({ url: this.url, form, headers: this.headers });
      const reply = replies.length > 1 ? replies.shift()! : replies[0]!;
      setTimeout(() => {
        if (reply === 'error') return this.onerror!();
        this.upload.onprogress!({ lengthComputable: true, loaded: 1, total: 2 });
        this.status = reply.status;
        this.responseText = JSON.stringify(reply.body);
        this.onload!();
      }, 0);
    }
  }
  vi.stubGlobal('XMLHttpRequest', FakeRequest);
  return sent;
}

/** Image APIs missing from the test DOM: previews get fake URLs and compression keeps the original file. */
export function stubImages(): void {
  let n = 0;
  Object.assign(URL, { createObjectURL: vi.fn(() => `blob:${++n}`), revokeObjectURL: vi.fn() });
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => {
      throw new Error('no canvas in tests');
    }),
  );
}

/** Picks files in the gallery input of BasePhotoUpload. */
export function pickFiles(names: string[]): void {
  const input = document.querySelector<HTMLInputElement>('input[type="file"][multiple]')!;
  const files = names.map((name) => new File(['x'], name, { type: 'image/jpeg' }));
  Object.defineProperty(input, 'files', { value: files, configurable: true });
  input.dispatchEvent(new Event('change'));
}

/** Activates a Reka tab the way a mouse does. */
export function openTab(label: string): void {
  const tab = [...document.querySelectorAll<HTMLElement>('[role="tab"]')].find((item) =>
    item.textContent?.trim().startsWith(label),
  );
  if (!tab) throw new Error(`No tab ${label}`);
  tab.dispatchEvent(new MouseEvent('mousedown', { button: 0, ctrlKey: false, bubbles: true }));
}

/** Toggles the switch labeled `label`. */
export function toggle(label: string): void {
  const tag = [...document.querySelectorAll('label')].find((item) => item.textContent?.trim() === label);
  if (!tag) throw new Error(`No switch ${label}`);
  document.getElementById(tag.htmlFor)!.click();
}
