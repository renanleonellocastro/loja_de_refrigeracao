import type { Ref } from 'vue';

type Values = Record<string, unknown>;

export interface FormOptions<T extends Values> {
  /** Checks in the browser before calling the API; returns messages by field path. */
  validate?: (values: T) => FieldErrors;
  /** Shows general errors in `message` (for an alert inside the form) instead of a toast. */
  inline?: boolean;
}

export interface Form<T extends Values> {
  values: T;
  errors: Ref<FieldErrors>;
  pending: Ref<boolean>;
  /** General error of the last attempt when the form shows it inline. */
  message: Ref<string>;
  /** Message of a field, for the `error` prop of the inputs: `form.error('address.cep')`. */
  error: (path: string) => string | undefined;
  /** Runs the action; on failure shows field errors next to the inputs and general errors in a toast. */
  submit: (action: (values: T) => Promise<void>) => Promise<boolean>;
  /** Replaces the values, for example after loading the record to edit. */
  reset: (next: T) => void;
}

/** Form values are plain JSON; this also strips Vue proxies, which structuredClone rejects. */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isPlainObject(value: unknown): value is Values {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Flattens nested values into paths like the API uses: { address: { cep } } becomes "address.cep". */
export function flattenPaths(values: Values, prefix = ''): Record<string, unknown> {
  const flat: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(value)) Object.assign(flat, flattenPaths(value, path));
    else flat[path] = value;
  }
  return flat;
}

/** Moves the focus to the first invalid field so keyboard and screen reader users land on the problem. */
async function focusFirstInvalid(): Promise<void> {
  await nextTick();
  document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
}

/** Form state with validation and API error handling shared by every form of the site. */
export function useForm<T extends Values>(initial: T, options: FormOptions<T> = {}): Form<T> {
  const values = reactive(clone(initial)) as T;
  const errors = ref<FieldErrors>({});
  const pending = ref(false);
  const message = ref('');
  const toast = useToast();

  // Typing in a field clears its message.
  watch(
    () => flattenPaths(values),
    (now, before) => {
      const changed = Object.keys(now).filter((path) => now[path] !== before[path]);
      if (changed.length === 0) return;
      const next = { ...errors.value };
      for (const path of changed) delete next[path];
      errors.value = next;
    },
  );

  async function submit(action: (values: T) => Promise<void>): Promise<boolean> {
    const local = options.validate?.(values) ?? {};
    errors.value = local;
    message.value = '';
    if (Object.keys(local).length > 0) {
      await focusFirstInvalid();
      return false;
    }
    pending.value = true;
    try {
      await action(values);
      return true;
    } catch (caught) {
      const error = toApiError(caught);
      const known = new Set(Object.keys(flattenPaths(values)));
      const unknown = Object.entries(error.fields).filter(([path]) => !known.has(path));
      errors.value = Object.fromEntries(Object.entries(error.fields).filter(([path]) => known.has(path)));
      if (unknown.length > 0 || !error.hasFieldErrors) {
        const details = unknown.map(([, text]) => text).join(' ');
        if (options.inline) message.value = [error.message, details].filter(Boolean).join(' ');
        else toast.error({ title: error.message, description: details || undefined });
      }
      await focusFirstInvalid();
      return false;
    } finally {
      pending.value = false;
    }
  }

  function reset(next: T): void {
    Object.assign(values, clone(next));
    errors.value = {};
    message.value = '';
  }

  return { values, errors, pending, message, error: (path) => errors.value[path], submit, reset };
}
