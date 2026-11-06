import type { ComputedRef, Ref } from 'vue';

export interface FormStepsOptions {
  /** Field errors of the form, so moving on shows the problems of the step on screen. */
  errors: Ref<FieldErrors>;
  /** Every browser check of the form; each step keeps only the messages of its own fields. */
  validate: () => FieldErrors;
  /** Free steps can be opened in any order (editing); otherwise the person goes forward one step at a time. */
  free?: boolean;
}

export interface FormSteps {
  /** True on the phone, where the form shows one step at a time; tablets and computers show every field. */
  stepped: ComputedRef<boolean>;
  steps: readonly FormStep[];
  current: Ref<number>;
  /** Furthest step reached, so a linear form only lets the person go back to steps already seen. */
  reached: Ref<number>;
  free: boolean;
  /** The phone shows a step that is not the last one, so the main button moves on instead of saving. */
  hasNext: ComputedRef<boolean>;
  shows: (field: string) => boolean;
  next: () => Promise<void>;
  back: () => Promise<void>;
  goTo: (index: number) => Promise<void>;
  /** After a failed save, opens the step of the first field with a message and moves the focus to it. */
  revealFirstError: () => Promise<void>;
}

async function focusFirstInvalid(): Promise<void> {
  await nextTick();
  document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
}

function errorsOfStep(errors: FieldErrors, step: FormStep): FieldErrors {
  return Object.fromEntries(Object.entries(errors).filter(([field]) => step.fields.includes(field)));
}

function stepOfField(steps: readonly FormStep[], field: string): number {
  return steps.findIndex((step) => step.fields.includes(field));
}

/** Moves between steps and puts the focus on the step heading, marked with data-step-heading. */
function stepMover(current: Ref<number>, reached: Ref<number>) {
  return async (index: number): Promise<void> => {
    current.value = index;
    reached.value = Math.max(reached.value, index);
    await nextTick();
    document.querySelector<HTMLElement>('[data-step-heading]')?.focus();
  };
}

function stepAdvancer(state: Pick<FormSteps, 'steps' | 'current' | 'goTo'>, options: FormStepsOptions) {
  return async (): Promise<void> => {
    const errors = errorsOfStep(options.validate(), state.steps[state.current.value]!);
    options.errors.value = errors;
    if (Object.keys(errors).length > 0) return focusFirstInvalid();
    await state.goTo(state.current.value + 1);
  };
}

function errorRevealer(state: Pick<FormSteps, 'stepped' | 'steps' | 'goTo'>, errors: Ref<FieldErrors>) {
  return async (): Promise<void> => {
    const first = Object.keys(errors.value).find((field) => stepOfField(state.steps, field) >= 0);
    if (!state.stepped.value || first === undefined) return;
    await state.goTo(stepOfField(state.steps, first));
    await focusFirstInvalid();
  };
}

type StepState = Pick<FormSteps, 'stepped' | 'steps' | 'current' | 'reached' | 'goTo'>;

function stepState(steps: readonly FormStep[]): StepState {
  const viewport = useViewport();
  const current = ref(0);
  const reached = ref(0);
  const stepped = computed(() => viewport.value === 'phone');
  return { stepped, steps, current, reached, goTo: stepMover(current, reached) };
}

/** A form that shows one step at a time on the phone (docs/DESIGN.md, forms) and every field on wider screens. */
export function useFormSteps(steps: readonly FormStep[], options: FormStepsOptions): FormSteps {
  const state = stepState(steps);
  const { stepped, current } = state;
  return {
    ...state,
    free: options.free ?? false,
    hasNext: computed(() => stepped.value && current.value < steps.length - 1),
    shows: (field) => !stepped.value || steps[current.value]!.fields.includes(field),
    next: stepAdvancer(state, options),
    back: () => state.goTo(current.value - 1),
    revealFirstError: errorRevealer(state, options.errors),
  };
}
