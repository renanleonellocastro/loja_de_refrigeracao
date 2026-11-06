import type { ComputedRef, Ref } from 'vue';
import type { Form } from './useForm';
import { conflictRows, mergeOnSaved, type ConflictForms, type ConflictRow } from '~/utils/product-conflict';
import type { ProductForm } from '~/utils/products';

export interface ProductConflictOptions {
  /** Version the person started editing from. */
  product: Ref<ProductDetail | null>;
  categories: Ref<Category[]>;
  form: Form<ProductForm>;
  /** Reads the version saved now. */
  fetchSaved: () => Promise<ProductDetail>;
  /** Puts a version on screen, dropping what the person typed. */
  show: (product: ProductDetail) => void;
  /** Reloads the whole page when the saved version could not be read. */
  reload: () => Promise<void>;
}

export interface ProductConflict {
  open: Ref<boolean>;
  /** Differences to show, or null while the saved version is unknown. */
  rows: ComputedRef<ConflictRow[] | null>;
  report: () => Promise<void>;
  keepMine: () => void;
  useSaved: () => Promise<void>;
  close: () => void;
}

function conflictForms(options: ProductConflictOptions, saved: ProductDetail): ConflictForms {
  return {
    base: productFormFrom(options.product.value),
    mine: options.form.values,
    saved: productFormFrom(saved),
  };
}

async function readSaved(options: ProductConflictOptions): Promise<ProductDetail | null> {
  try {
    return await options.fetchSaved();
  } catch {
    // The page still offers the reload, as before the differences existed.
    return null;
  }
}

interface ConflictState {
  open: Ref<boolean>;
  saved: Ref<ProductDetail | null>;
  close: () => void;
}

function conflictState(): ConflictState {
  const open = ref(false);
  const saved = ref<ProductDetail | null>(null);
  const close = () => {
    open.value = false;
    saved.value = null;
  };
  return { open, saved, close };
}

function conflictRowsOf(
  options: ProductConflictOptions,
  state: ConflictState,
): ComputedRef<ConflictRow[] | null> {
  return computed(() => {
    const saved = state.saved.value;
    return saved ? conflictRows(conflictForms(options, saved), options.categories.value) : null;
  });
}

function conflictReporter(options: ProductConflictOptions, state: ConflictState): () => Promise<void> {
  return async () => {
    state.open.value = true;
    state.saved.value = await readSaved(options);
  };
}

function mineKeeper(options: ProductConflictOptions, state: ConflictState): () => void {
  return () => {
    const merged = mergeOnSaved(conflictForms(options, state.saved.value!));
    options.product.value = state.saved.value;
    options.form.reset(merged);
    state.close();
  };
}

function savedUser(options: ProductConflictOptions, state: ConflictState): () => Promise<void> {
  return async () => {
    if (state.saved.value) options.show(state.saved.value);
    else await options.reload();
    state.close();
  };
}

/**
 * Edit conflict of the product page (RF-12): after a 412 reads the saved version, lists the differences and either
 * keeps the person's edits on top of it (the next save carries the new version in If-Match) or drops them.
 */
export function useProductConflict(options: ProductConflictOptions): ProductConflict {
  const state = conflictState();
  return {
    open: state.open,
    close: state.close,
    rows: conflictRowsOf(options, state),
    report: conflictReporter(options, state),
    keepMine: mineKeeper(options, state),
    useSaved: savedUser(options, state),
  };
}
