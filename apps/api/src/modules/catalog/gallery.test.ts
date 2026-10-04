import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { auditLogs, productImages } from '../../infra/db/schema.js';
import { createCategory, createProduct } from '../../../test/catalog.js';
import { useTestApp } from '../../../test/harness.js';
import { jpeg } from '../../../test/images.js';
import { multipart, type MultipartPart } from '../../../test/multipart.js';

interface ImageView {
  id: number;
  position: number;
  isCover: boolean;
  url: string;
}

describe('product photos', () => {
  const t = useTestApp();

  async function setup() {
    const category = await createCategory(t, 'Geladeiras');
    const manager = await t.as('MANAGER');
    const product = await createProduct(t, manager.headers, { categoryId: category.id, name: 'Geladeira' });
    return { headers: manager.headers, product, categoryId: category.id };
  }

  /** Small distinct photos: each size gives a different content addressed key. */
  const photos = (count: number, offset = 0) =>
    Promise.all(Array.from({ length: count }, (_, i) => jpeg(40 + offset + i, 30)));

  const filesOf = (buffers: Buffer[]): MultipartPart[] =>
    buffers.map((value, i) => ({ name: 'fotos', value, filename: `${i}.jpg`, contentType: 'image/jpeg' }));

  function upload(productId: number, headers: Record<string, string>, parts: MultipartPart[]) {
    const body = multipart(parts);
    return t.app.inject({
      method: 'POST',
      url: `/api/v1/products/${productId}/images`,
      payload: body.payload,
      headers: { ...headers, ...body.headers },
    });
  }

  const contentKey = (data: Buffer) => createHash('sha256').update(data).digest('hex').slice(0, 32);

  const keyOf = (image: ImageView) => /media\/([a-f0-9]{32})\//.exec(image.url)![1]!;

  async function insertRows(productId: number, count: number) {
    await t.db.insert(productImages).values(
      Array.from({ length: count }, (_, i) => ({
        productId,
        storageKey: `${'0'.repeat(30)}${String(i).padStart(2, '0')}`,
        width: 100,
        height: 100,
        position: i,
        isCover: i === 0,
      })),
    );
  }

  it('appends photos in order, the first ever photo being the cover', async () => {
    const { headers, product } = await setup();
    const first = await upload(product.id, headers, filesOf(await photos(2)));
    expect(first.statusCode).toBe(201);
    expect(first.headers.location).toBe(`/api/v1/products/${product.id}`);
    expect(first.json()).toMatchObject([
      { position: 0, isCover: true, width: 40, srcset: expect.stringContaining('320w') },
      { position: 1, isCover: false, width: 41 },
    ]);
    const second = await upload(product.id, headers, filesOf(await photos(1, 10)));
    expect(second.json().map((image: ImageView) => [image.position, image.isCover])).toEqual([
      [0, true],
      [1, false],
      [2, false],
    ]);
    const [audit] = await t.db.select().from(auditLogs).where(eq(auditLogs.action, 'product.images.add'));
    expect(audit).toMatchObject({
      resourceId: String(product.id),
      after: { keys: [expect.any(String), expect.any(String)] },
    });

    const listed = await t.app.inject({ method: 'GET', url: '/api/v1/products' });
    expect(listed.json().data[0].cover).toMatchObject({ id: first.json()[0].id, isCover: true });
  });

  it('refuses requests without photos, with too many, or for a missing product', async () => {
    const { headers, product } = await setup();
    const none = await upload(product.id, headers, [{ name: 'descricao', value: 'sem foto' }]);
    expect(none.json()).toMatchObject({ status: 422, title: 'Nenhuma foto enviada' });

    const eleven = await upload(product.id, headers, filesOf(await photos(11)));
    expect(eleven.json()).toMatchObject({ status: 422, title: 'Fotos demais' });

    await insertRows(product.id, 15);
    const over = await upload(product.id, headers, filesOf(await photos(6)));
    expect(over.json()).toMatchObject({ status: 422, detail: expect.stringContaining('no máximo mais 5') });
    await insertRows(product.id, 5);
    const full = await upload(product.id, headers, filesOf(await photos(1)));
    expect(full.json()).toMatchObject({ status: 422, detail: expect.stringContaining('já tem 20 fotos') });

    const missing = await upload(999999, headers, filesOf(await photos(1)));
    expect(missing.statusCode).toBe(404);
  });

  it('keeps no files when a photo of the request is not accepted', async () => {
    const { headers, product } = await setup();
    const [good] = await photos(1);
    const response = await upload(product.id, headers, [
      ...filesOf([good!]),
      { name: 'fotos', value: Buffer.from('não sou foto'), filename: 'x.jpg', contentType: 'image/jpeg' },
    ]);
    expect(response.statusCode).toBe(415);
    expect(await t.db.select().from(productImages)).toEqual([]);
    const stored = await upload(product.id, headers, filesOf([good!]));
    const key = keyOf(stored.json()[0]);
    // Removing the row of a successful upload proves the failed one had left nothing behind.
    await t.app.inject({
      method: 'DELETE',
      url: `/api/v1/products/${product.id}/images/${stored.json()[0].id}`,
      headers,
    });
    expect(await t.ctx.storage.get(`${key}/320.webp`)).toBeNull();
  });

  it('never goes over the limit with concurrent uploads, cleaning the losing files', async () => {
    const { headers, product } = await setup();
    await insertRows(product.id, 5);
    const [a, b] = await Promise.all([photos(10, 100), photos(10, 200)]);
    const results = await Promise.all([
      upload(product.id, headers, filesOf(a!)),
      upload(product.id, headers, filesOf(b!)),
    ]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([201, 422]);
    expect(
      await t.db.select().from(productImages).where(eq(productImages.productId, product.id)),
    ).toHaveLength(15);
    const loser = results.find((r) => r.statusCode === 422)!;
    expect(loser.json().detail).toContain('no máximo mais 5');
    const [winnerFiles, loserFiles] = results[0]!.statusCode === 201 ? [a!, b!] : [b!, a!];
    for (const file of winnerFiles)
      expect(await t.ctx.storage.get(`${contentKey(file)}/320.webp`)).not.toBeNull();
    for (const file of loserFiles) expect(await t.ctx.storage.get(`${contentKey(file)}/320.webp`)).toBeNull();
  });

  it('reorders the gallery and picks the cover', async () => {
    const { headers, product } = await setup();
    const images: ImageView[] = (await upload(product.id, headers, filesOf(await photos(3)))).json();
    const [a, b, c] = images.map((image) => image.id);
    const reorder = (payload: object, id = product.id) =>
      t.app.inject({ method: 'PUT', url: `/api/v1/products/${id}/images/order`, headers, payload });

    const withCover = await reorder({ imageIds: [c, b, a], coverId: b });
    expect(withCover.json().map((i: ImageView) => [i.id, i.position, i.isCover])).toEqual([
      [b, 1, true],
      [c, 0, false],
      [a, 2, false],
    ]);
    const keepCover = await reorder({ imageIds: [a, b, c] });
    expect(keepCover.json().map((i: ImageView) => i.id)).toEqual([b, a, c]);

    const detail = await t.app.inject({ method: 'GET', url: `/api/v1/products/${product.id}` });
    expect(detail.json().images.map((i: ImageView) => i.id)).toEqual([b, a, c]);

    for (const payload of [{ imageIds: [a, b] }, { imageIds: [a, b, b] }, { imageIds: [a, b, 999999] }]) {
      expect((await reorder(payload)).json()).toMatchObject({ status: 422, title: 'Ordem inválida' });
    }
    expect((await reorder({ imageIds: [a, b, c], coverId: 999999 })).json()).toMatchObject({
      status: 422,
      errors: [{ path: 'coverId', message: 'A capa deve ser uma das fotos do produto.' }],
    });
    expect((await reorder({ imageIds: [a] }, 999999)).statusCode).toBe(404);
    const [audit] = await t.db.select().from(auditLogs).where(eq(auditLogs.action, 'product.images.reorder'));
    expect(audit).toMatchObject({ after: { imageIds: [c, b, a], coverId: b } });
  });

  it('removes photos, promoting the next one when the cover goes, and cleans unused files', async () => {
    const { headers, product, categoryId } = await setup();
    const other = await createProduct(t, headers, { categoryId, name: 'Outra geladeira' });
    const files = await photos(3);
    const images: ImageView[] = (await upload(product.id, headers, filesOf(files))).json();
    await upload(other.id, headers, filesOf([files[0]!]));
    const remove = (imageId: number, id = product.id) =>
      t.app.inject({ method: 'DELETE', url: `/api/v1/products/${id}/images/${imageId}`, headers });

    expect((await remove(images[1]!.id)).statusCode).toBe(204);
    expect(await t.ctx.storage.get(`${keyOf(images[1]!)}/320.webp`)).toBeNull();
    let rows = await t.db.select().from(productImages).where(eq(productImages.productId, product.id));
    expect(rows.find((row) => row.isCover)!.id).toBe(images[0]!.id);

    expect((await remove(images[0]!.id)).statusCode).toBe(204);
    // The other product still shows the same photo, so the file stays.
    expect(await t.ctx.storage.get(`${keyOf(images[0]!)}/320.webp`)).not.toBeNull();
    rows = await t.db.select().from(productImages).where(eq(productImages.productId, product.id));
    expect(rows).toMatchObject([{ id: images[2]!.id, isCover: true }]);

    expect((await remove(images[2]!.id)).statusCode).toBe(204);
    expect((await remove(images[2]!.id)).statusCode).toBe(404);
    const otherImage = (
      await t.db.select().from(productImages).where(eq(productImages.productId, other.id))
    )[0]!;
    expect((await remove(otherImage.id)).statusCode).toBe(404);
    expect((await remove(otherImage.id, 999999)).statusCode).toBe(404);
    const audits = await t.db.select().from(auditLogs).where(eq(auditLogs.action, 'product.images.remove'));
    expect(audits).toHaveLength(3);
  });
});
