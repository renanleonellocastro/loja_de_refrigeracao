export interface CompressOptions {
  /** Longest side in pixels after resizing. */
  maxSize?: number;
  type?: 'image/jpeg' | 'image/webp';
  quality?: number;
}

/** Scales a size down so its longest side fits `max`, keeping the aspect ratio. Never scales up. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const ratio = max / longest;
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

function renamed(name: string, type: string): string {
  const extension = type === 'image/webp' ? 'webp' : 'jpg';
  return `${name.replace(/\.[^.]+$/, '')}.${extension}`;
}

type CompressSettings = Required<CompressOptions>;

function compressSettings(options: CompressOptions): CompressSettings {
  const { maxSize = 2048, type = 'image/jpeg', quality = 0.85 } = options;
  return { maxSize, type, quality };
}

/** Draws the bitmap on a canvas scaled to fit `maxSize`; null when the browser has no 2D context. */
function drawResized(bitmap: ImageBitmap, maxSize: number): HTMLCanvasElement | null {
  const size = fitWithin(bitmap.width, bitmap.height, maxSize);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close();
  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement, settings: CompressSettings): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, settings.type, settings.quality));
}

async function encodeResized(file: File, settings: CompressSettings): Promise<File> {
  const canvas = drawResized(await createImageBitmap(file), settings.maxSize);
  if (!canvas) return file;
  const blob = await canvasToBlob(canvas, settings);
  if (!blob) return file;
  return new File([blob], renamed(file.name, settings.type), {
    type: settings.type,
    lastModified: file.lastModified,
  });
}

/**
 * Resizes a photo in the browser before upload so phone pictures do not cost minutes on 4G.
 * Falls back to the original file when the browser cannot decode or encode it.
 */
export async function compressImage(file: File, options: CompressOptions = {}): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  try {
    return await encodeResized(file, compressSettings(options));
  } catch {
    return file;
  }
}
