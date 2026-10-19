/** Message of one field when its value breaks a rule, or undefined when the value is fine. */
export type FieldRule = () => string | undefined;

type FailedRule = readonly [path: string, message: string];

function hasMessage(entry: readonly [string, string | undefined]): entry is FailedRule {
  return entry[1] !== undefined;
}

/** Runs the rules of a form, one per field path, and keeps the message of every field that failed. */
export function collectFieldErrors(rules: Readonly<Record<string, FieldRule>>): FieldErrors {
  const checked = Object.entries(rules).map(([path, rule]) => [path, rule()] as const);
  return Object.fromEntries(checked.filter(hasMessage));
}

/** Whole number written as digits only, such as a quantity typed in a number input. */
export function isWholeNumberText(text: string): boolean {
  return /^\d+$/.test(text);
}
