import { CONDITION_OPTIONS, productToApi, type ProductForm } from './products';

/**
 * Edit conflict of a product (RF-12): someone saved another version while the person edited. Compares three forms:
 * the version the person started from (base), what the person typed (mine) and the version saved now (saved).
 */

type ProductBody = ReturnType<typeof productToApi>;
export type ProductConflictField = keyof ProductBody;
export type ConflictAuthor = 'other' | 'me' | 'both';

export interface ConflictRow {
  field: ProductConflictField;
  label: string;
  saved: string;
  mine: string;
  changedBy: ConflictAuthor;
}

export interface ConflictForms {
  base: ProductForm;
  mine: ProductForm;
  saved: ProductForm;
}

const FIELD_LABELS: Record<ProductConflictField, string> = {
  name: 'Nome do produto',
  categoryId: 'Categoria',
  condition: 'Condição',
  brand: 'Marca',
  model: 'Modelo',
  priceCents: 'Preço',
  stockMin: 'Estoque mínimo',
  description: 'Descrição',
};

const CONFLICT_FIELDS = Object.keys(FIELD_LABELS) as ProductConflictField[];

export const CONFLICT_AUTHOR_LABELS: Record<ConflictAuthor, string> = {
  other: 'Mudou na outra versão',
  me: 'Você mudou',
  both: 'Os dois mudaram',
};

type Formatter = (body: ProductBody, categories: readonly Category[]) => string;

const EMPTY = 'Vazio';

const FORMATTERS: Partial<Record<ProductConflictField, Formatter>> = {
  categoryId: (body, categories) =>
    categories.find((category) => category.id === body.categoryId)?.name ?? EMPTY,
  condition: (body) => CONDITION_OPTIONS.find((option) => option.value === body.condition)!.label,
  priceCents: (body) => formatMoney(body.priceCents),
  stockMin: (body) => (body.stockMin === null ? 'Padrão da loja' : String(body.stockMin)),
};

/** Text of one field as the person reads it: names instead of ids, money as reais, blank as "Vazio". */
export function conflictValue(
  field: ProductConflictField,
  body: ProductBody,
  categories: readonly Category[],
): string {
  const format = FORMATTERS[field];
  if (format) return format(body, categories);
  const value = body[field];
  return value === null || value === '' ? EMPTY : String(value);
}

function bodies(forms: ConflictForms): Record<keyof ConflictForms, ProductBody> {
  return { base: productToApi(forms.base), mine: productToApi(forms.mine), saved: productToApi(forms.saved) };
}

function changedBy(
  field: ProductConflictField,
  body: Record<keyof ConflictForms, ProductBody>,
): ConflictAuthor {
  const otherChanged = body.saved[field] !== body.base[field];
  const iChanged = body.mine[field] !== body.base[field];
  if (otherChanged && iChanged) return 'both';
  return otherChanged ? 'other' : 'me';
}

/** Fields where the saved version and what the person typed differ, with who changed each one. */
export function conflictRows(forms: ConflictForms, categories: readonly Category[]): ConflictRow[] {
  const body = bodies(forms);
  return CONFLICT_FIELDS.filter((field) => body.saved[field] !== body.mine[field]).map((field) => ({
    field,
    label: FIELD_LABELS[field],
    saved: conflictValue(field, body.saved, categories),
    mine: conflictValue(field, body.mine, categories),
    changedBy: changedBy(field, body),
  }));
}

/** The saved version with the fields the person changed on top: both edits survive, the person's wins on a tie. */
export function mergeOnSaved(forms: ConflictForms): ProductForm {
  const body = bodies(forms);
  const merged: ProductForm = { ...forms.saved };
  for (const field of CONFLICT_FIELDS) {
    if (body.mine[field] !== body.base[field]) Object.assign(merged, { [field]: forms.mine[field] });
  }
  return merged;
}
