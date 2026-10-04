import { afterEach, describe, expect, it, vi } from 'vitest';
import { addToCounter, counterLimit, counterTotal } from '~/utils/counter';
import {
  ifMatch,
  moveItem,
  productFormFrom,
  productToApi,
  signedQuantity,
  validateMovement,
  validateProductForm,
} from '~/utils/products';
import { uploadWithProgress } from '~/utils/upload';
import { detail, product } from '../support/shop';

describe('product form', () => {
  it('starts blank or from a product', () => {
    expect(productFormFrom(null)).toMatchObject({ name: '', categoryId: '', condition: 'NEW', stockMin: '' });
    expect(productFormFrom(detail({ stockMin: 3 }))).toMatchObject({ categoryId: '7', stockMin: '3' });
    expect(productFormFrom(detail({ brand: null, model: null })).brand).toBe('');
  });

  it('validates like the API', () => {
    const valid = { ...productFormFrom(detail()), priceCents: 100 };
    expect(validateProductForm(valid, true)).toEqual({});
    const errors = validateProductForm(
      {
        ...valid,
        name: 'ab',
        categoryId: '',
        brand: 'x'.repeat(61),
        model: 'x'.repeat(61),
        description: 'x'.repeat(5001),
        priceCents: 0,
        initialStock: '-1',
        stockMin: 'a',
      },
      true,
    );
    expect(Object.keys(errors).sort()).toEqual(
      [
        'brand',
        'categoryId',
        'description',
        'initialStock',
        'model',
        'name',
        'priceCents',
        'stockMin',
      ].sort(),
    );
    expect(validateProductForm({ ...valid, name: 'x'.repeat(121), priceCents: 100_000_001 }, false)).toEqual({
      name: 'Use até 120 letras no nome.',
      priceCents: 'Preço alto demais. Confira o valor.',
    });
    expect(validateProductForm({ ...valid, initialStock: 'x' }, false)).toEqual({});
  });

  it('builds the API body and the If-Match header', () => {
    const values = { ...productFormFrom(detail()), brand: ' ', model: ' X ', stockMin: ' 4 ' };
    expect(productToApi(values)).toMatchObject({ categoryId: 7, brand: null, model: 'X', stockMin: 4 });
    expect(productToApi({ ...values, stockMin: '' }).stockMin).toBeNull();
    expect(ifMatch(3)).toBe('W/"3"');
  });
});

describe('stock movements', () => {
  it('validates quantity and reason by type', () => {
    expect(validateMovement({ type: 'IN', quantity: '5', reason: '' })).toEqual({});
    expect(validateMovement({ type: 'IN', quantity: 'x', reason: '' }).quantity).toContain('inteiro');
    expect(validateMovement({ type: 'IN', quantity: '0', reason: '' }).quantity).toContain('maior que zero');
    expect(validateMovement({ type: 'ADJUSTMENT', quantity: '0', reason: 'a' }).quantity).toContain(
      'diferente',
    );
    expect(validateMovement({ type: 'ADJUSTMENT', quantity: '-2', reason: 'Contagem' })).toEqual({});
    expect(validateMovement({ type: 'LOSS', quantity: '1', reason: ' ' }).reason).toBe('Informe o motivo.');
    expect(validateMovement({ type: 'LOSS', quantity: '1', reason: 'x'.repeat(301) }).reason).toContain(
      '300',
    );
  });

  it('formats signed quantities and moves list items', () => {
    expect(signedQuantity(5)).toBe('+5');
    expect(signedQuantity(-2)).toBe('-2');
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
  });
});

describe('counter sale', () => {
  it('adds products up to the stock and sums the total', () => {
    const item = product({ stockAvailable: 2, priceCents: 1000 });
    let lines = addToCounter([], item);
    lines = addToCounter(lines, item);
    lines = addToCounter(lines, item);
    expect(lines).toEqual([{ product: item, quantity: 2 }]);
    lines = addToCounter(lines, product({ id: 2, priceCents: 500 }));
    lines = addToCounter(lines, product({ id: 2, priceCents: 500 }));
    expect(counterTotal(lines)).toBe(3000);
    expect(counterLimit(product({ stockAvailable: 500 }))).toBe(99);
    expect(counterLimit(product({ stockAvailable: -1 }))).toBe(0);
  });
});

describe('uploadWithProgress', () => {
  afterEach(() => vi.unstubAllGlobals());

  class FakeRequest {
    static last: FakeRequest;
    headers: Record<string, string> = {};
    upload: { onprogress?: (event: Partial<ProgressEvent>) => void } = {};
    onload?: () => void;
    onerror?: () => void;
    status = 0;
    responseText = '';
    constructor() {
      FakeRequest.last = this;
    }
    open = vi.fn();
    setRequestHeader(name: string, value: string) {
      this.headers[name] = value;
    }
    send = vi.fn();
  }

  it('reports progress and resolves with the parsed answer', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeRequest);
    const progress: number[] = [];
    const pending = uploadWithProgress('/up', new FormData(), 'abc', (value) => progress.push(value));
    const request = FakeRequest.last;
    expect(request.headers.authorization).toBe('Bearer abc');
    request.upload.onprogress!({ lengthComputable: false, loaded: 1, total: 0 });
    request.upload.onprogress!({ lengthComputable: true, loaded: 1, total: 4 });
    request.status = 201;
    request.responseText = '[1]';
    request.onload!();
    expect(await pending).toEqual({ status: 201, body: [1] });
    expect(progress).toEqual([25]);
  });

  it('keeps a non JSON answer as null and rejects on a dropped connection', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeRequest);
    const pending = uploadWithProgress('/up', new FormData(), null, () => {});
    const request = FakeRequest.last;
    expect(request.headers.authorization).toBeUndefined();
    request.status = 502;
    request.responseText = '<html>';
    request.onload!();
    expect(await pending).toEqual({ status: 502, body: null });

    const failing = uploadWithProgress('/up', new FormData(), null, () => {});
    FakeRequest.last.onerror!();
    await expect(failing).rejects.toThrow('network');
  });
});
