import sharp from 'sharp';

/** A real photo-like JPEG of the given size, optionally with an EXIF orientation. */
export function jpeg(width: number, height: number, orientation?: number): Promise<Buffer> {
  const image = sharp({
    create: { width, height, channels: 3, background: { r: 24, g: 78, b: 134 } },
  }).jpeg();
  return (orientation ? image.withMetadata({ orientation }) : image).toBuffer();
}

export function gif(): Promise<Buffer> {
  return sharp({ create: { width: 10, height: 10, channels: 3, background: '#fff' } })
    .gif()
    .toBuffer();
}
