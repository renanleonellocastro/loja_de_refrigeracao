import { describe, expect, it } from 'vitest';
import {
  activeFilterCount,
  countLabel,
  facetParams,
  filtersFromQuery,
  mediaSrcset,
  mediaUrl,
  productParams,
  queryFromFilters,
} from '~/utils/catalog';
import { ORDER_NEXT_STEP, orderTimeline } from '~/utils/orders';
import { order } from '../support/shop';

describe('catalog filters in the address', () => {
  it('reads every filter and ignores malformed values', () => {
    const filters = filtersFromQuery({
      q: ['  geladeira  ', 'x'],
      categoria: '7',
      condicao: 'usado',
      marca: 'Consul',
      min: '100',
      max: 'abc',
      disponiveis: '1',
      ordem: 'menor-preco',
      pagina: '3',
    });
    expect(filters).toEqual({
      q: 'geladeira',
      categoryId: 7,
      condition: 'USED',
      brand: 'Consul',
      minPrice: 100,
      maxPrice: undefined,
      onlyAvailable: true,
      sort: 'menor-preco',
      page: 3,
    });
    expect(
      filtersFromQuery({ categoria: '0', condicao: 'velho', ordem: 'aleatorio', pagina: '-2', q: [null] }),
    ).toEqual({
      q: '',
      categoryId: undefined,
      condition: undefined,
      brand: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      onlyAvailable: false,
      sort: '',
      page: 1,
    });
  });

  it('writes short links and the API queries', () => {
    const empty = filtersFromQuery({});
    expect(queryFromFilters(empty)).toEqual({});
    expect(activeFilterCount(empty)).toBe(0);
    const full = filtersFromQuery({
      q: 'ar',
      categoria: '3',
      condicao: 'novo',
      marca: 'Gree',
      min: '0',
      max: '2000',
      disponiveis: '1',
      ordem: 'nome',
      pagina: '2',
    });
    expect(queryFromFilters(full)).toEqual({
      q: 'ar',
      categoria: '3',
      condicao: 'novo',
      marca: 'Gree',
      min: '0',
      max: '2000',
      disponiveis: '1',
      ordem: 'nome',
      pagina: '2',
    });
    expect(queryFromFilters({ ...full, condition: 'USED' }).condicao).toBe('usado');
    expect(activeFilterCount(full)).toBe(5);
    expect(productParams(full)).toEqual({
      q: 'ar',
      categoryId: 3,
      condition: 'NEW',
      brand: 'Gree',
      minPriceCents: 0,
      maxPriceCents: 200000,
      available: 'true',
      sort: 'name',
      page: 2,
      pageSize: 24,
    });
    expect(facetParams(empty)).toEqual({
      q: undefined,
      categoryId: undefined,
      condition: undefined,
      brand: undefined,
      minPriceCents: undefined,
      maxPriceCents: undefined,
      available: undefined,
    });
  });

  it('points media at the API origin', () => {
    expect(mediaUrl('http://api/', '/a.webp')).toBe('http://api/a.webp');
    expect(mediaUrl('http://api', 'https://cdn/a.webp')).toBe('https://cdn/a.webp');
    expect(mediaSrcset('http://api', '/a/320.webp 320w, /a/640.webp 640w,')).toBe(
      'http://api/a/320.webp 320w, http://api/a/640.webp 640w',
    );
    expect(mediaSrcset('http://api', '/a.webp')).toBe('http://api/a.webp');
    expect(countLabel(1, 'item', 'itens')).toBe('1 item');
    expect(countLabel(2, 'item', 'itens')).toBe('2 itens');
  });
});

describe('order timeline', () => {
  it('lists the newest event first with the cancellation reason', () => {
    const canceled = order({
      events: [
        ...order().events,
        {
          fromStatus: 'PENDING_REVIEW',
          toStatus: 'CANCELED',
          label: 'Pedido cancelado',
          actor: null,
          reason: 'Comprei por engano.',
          createdAt: '2026-10-03T16:00:00.000Z',
        },
      ],
    });
    const events = orderTimeline(canceled);
    expect(events.map((event) => event.title)).toEqual(['Pedido cancelado', 'Pedido recebido']);
    expect(events[0]!.description).toBe('Comprei por engano.');
    expect(events[1]!.description).toBeUndefined();
    expect(ORDER_NEXT_STEP.READY_FOR_PICKUP).toContain('retirar');
  });
});
