/** Shared look of text inputs: the frame carries border, focus ring and error state; the input inside is bare. */
export function controlFrameClasses(invalid: boolean, disabled = false): string[] {
  return [
    'group/control flex min-h-11 w-full items-center gap-2 rounded-md border bg-surface px-3.5 shadow-sm',
    'transition-[border-color,box-shadow] duration-150 ease-brand',
    'focus-within:border-primary focus-within:ring-4 focus-within:ring-focus/25',
    invalid ? 'border-danger' : 'border-border-strong/45 hover:border-border-strong',
    disabled ? 'cursor-not-allowed bg-surface-sunken' : '',
  ];
}

export const CONTROL_INPUT_CLASSES =
  'min-w-0 flex-1 bg-transparent py-2.5 text-base text-text outline-none placeholder:text-text-muted/80 focus-visible:outline-none disabled:cursor-not-allowed';

export const CONTROL_AFFIX_CLASSES =
  'flex shrink-0 items-center text-sm font-medium text-text-muted [&_svg]:size-5';
