import { describe, expect, it } from 'vitest';
import { conflictRows, conflictValue, mergeOnSaved } from '~/utils/product-conflict';
import { productFormFrom, productToApi } from '~/utils/products';
import { detail } from '../support/shop';

const CATEGORIES = [
  { id: 7, name: 'Peças e acessórios', slug: 'pecas', position: 1, productCount: 1 },
  { id: 1, name: 'Geladeiras', slug: 'geladeiras', position: 2, productCount: 0 },
] as Category[];

const base = productFormFrom(detail());

describe('conflictValue', () => {
  it('writes each field as the person reads it', () => {
    const body = productToApi({
      ...base,
      brand: ' ',
      stockMin: '',
      condition: 'USED',
      description: 'Linha 1',
    });
    expect(conflictValue('categoryId', body, CATEGORIES)).toBe('Peças e acessórios');
    expect(conflictValue('categoryId', body, [])).toBe('Vazio');
    expect(conflictValue('condition', body, CATEGORIES)).toBe('Usado');
    expect(conflictValue('priceCents', body, CATEGORIES)).toBe('R$ 499,00');
    expect(conflictValue('stockMin', body, CATEGORIES)).toBe('Padrão da loja');
    expect(conflictValue('stockMin', productToApi({ ...base, stockMin: '4' }), CATEGORIES)).toBe('4');
    expect(conflictValue('brand', body, CATEGORIES)).toBe('Vazio');
    expect(conflictValue('description', productToApi({ ...base, description: '' }), CATEGORIES)).toBe(
      'Vazio',
    );
    expect(conflictValue('name', body, CATEGORIES)).toBe('Compressor Embraco');
  });
});

describe('conflictRows', () => {
  it('lists only the fields that differ, with who changed each one', () => {
    const mine = { ...base, name: 'Compressor novo', priceCents: 59900, model: ' EMIS30HHR ' };
    const saved = { ...base, priceCents: 54900, categoryId: '1' };
    expect(conflictRows({ base, mine, saved }, CATEGORIES)).toEqual([
      {
        field: 'name',
        label: 'Nome do produto',
        saved: 'Compressor Embraco',
        mine: 'Compressor novo',
        changedBy: 'me',
      },
      {
        field: 'categoryId',
        label: 'Categoria',
        saved: 'Geladeiras',
        mine: 'Peças e acessórios',
        changedBy: 'other',
      },
      { field: 'priceCents', label: 'Preço', saved: 'R$ 549,00', mine: 'R$ 599,00', changedBy: 'both' },
    ]);
  });

  it('is empty when the form is the same in both versions', () => {
    expect(conflictRows({ base, mine: base, saved: { ...base } }, CATEGORIES)).toEqual([]);
  });
});

describe('mergeOnSaved', () => {
  it('keeps the saved version and puts the fields the person changed on top', () => {
    const mine = { ...base, name: 'Compressor novo', priceCents: 59900 };
    const saved = { ...base, priceCents: 54900, categoryId: '1', description: 'Outra.' };
    expect(mergeOnSaved({ base, mine, saved })).toEqual({
      ...saved,
      name: 'Compressor novo',
      priceCents: 59900,
    });
  });
});
