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

interface FormState<T extends Values> {
  values: T;
  errors: Ref<FieldErrors>;
  pending: Ref<boolean>;
  message: Ref<string>;
}

/** Shows the general error of a failed attempt, with the messages of fields the form does not have. */
type GeneralErrorReporter = (error: ApiError, details: string) => void;

type FormAction<T> = (values: T) => Promise<void>;

function createFormState<T extends Values>(initial: T): FormState<T> {
  return {
    values: reactive(clone(initial)) as T,
    errors: ref<FieldErrors>({}),
    pending: ref(false),
    message: ref(''),
  };
}

function clearChangedFieldErrors(errors: Ref<FieldErrors>, now: Values, before: Values): void {
  const changed = Object.keys(now).filter((path) => now[path] !== before[path]);
  if (changed.length === 0) return;
  const next = { ...errors.value };
  for (const path of changed) delete next[path];
  errors.value = next;
}

/** Typing in a field clears its message. */
function watchFieldEdits(values: Values, errors: Ref<FieldErrors>): void {
  watch(
    () => flattenPaths(values),
    (now, before) => clearChangedFieldErrors(errors, now, before),
  );
}

function inlineReporter(message: Ref<string>): GeneralErrorReporter {
  return (error, details) => {
    message.value = [error.message, details].filter(Boolean).join(' ');
  };
}

function toastReporter(toast: Pick<ReturnType<typeof useToast>, 'error'>): GeneralErrorReporter {
  return (error, details) => toast.error({ title: error.message, description: details || undefined });
}

/** Splits the field errors of the API into the ones the form shows next to an input and the leftover texts. */
function splitFieldErrors(error: ApiError, values: Values): { fields: FieldErrors; leftover: string[] } {
  const known = new Set(Object.keys(flattenPaths(values)));
  const entries = Object.entries(error.fields);
  return {
    fields: Object.fromEntries(entries.filter(([path]) => known.has(path))),
    leftover: entries.filter(([path]) => !known.has(path)).map(([, text]) => text),
  };
}

async function showFailure<T extends Values>(
  state: FormState<T>,
  caught: unknown,
  reportGeneral: GeneralErrorReporter,
): Promise<void> {
  const error = toApiError(caught);
  const { fields, leftover } = splitFieldErrors(error, state.values);
  state.errors.value = fields;
  if (leftover.length > 0 || !error.hasFieldErrors) reportGeneral(error, leftover.join(' '));
  await focusFirstInvalid();
}

async function runAction<T extends Values>(
  state: FormState<T>,
  action: FormAction<T>,
  reportGeneral: GeneralErrorReporter,
): Promise<boolean> {
  state.pending.value = true;
  try {
    await action(state.values);
    return true;
  } catch (caught) {
    await showFailure(state, caught, reportGeneral);
    return false;
  } finally {
    state.pending.value = false;
  }
}

/** Runs the browser checks; true when some field failed. Also clears the messages of the last attempt. */
function failsLocalValidation<T extends Values>(
  state: FormState<T>,
  validate: FormOptions<T>['validate'],
): boolean {
  const local = validate?.(state.values) ?? {};
  state.errors.value = local;
  state.message.value = '';
  return Object.keys(local).length > 0;
}

function formSubmitter<T extends Values>(
  state: FormState<T>,
  validate: FormOptions<T>['validate'],
  reportGeneral: GeneralErrorReporter,
): Form<T>['submit'] {
  return async (action) => {
    if (failsLocalValidation(state, validate)) {
      await focusFirstInvalid();
      return false;
    }
    return runAction(state, action, reportGeneral);
  };
}

function formResetter<T extends Values>(state: FormState<T>): Form<T>['reset'] {
  return (next) => {
    Object.assign(state.values, clone(next));
    state.errors.value = {};
    state.message.value = '';
  };
}

/** Form state with validation and API error handling shared by every form of the site. */
export function useForm<T extends Values>(initial: T, options: FormOptions<T> = {}): Form<T> {
  const state = createFormState(initial);
  const toast = useToast();
  const reportGeneral = options.inline ? inlineReporter(state.message) : toastReporter(toast);
  watchFieldEdits(state.values, state.errors);
  return {
    ...state,
    error: (path) => state.errors.value[path],
    submit: formSubmitter(state, options.validate, reportGeneral),
    reset: formResetter(state),
  };
}
