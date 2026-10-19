/** Whether `sent` lists every id of `current` exactly once, in any order. */
export function isCompleteOrder(sent: readonly number[], current: readonly number[]): boolean {
  const unique = new Set(sent);
  return (
    unique.size === sent.length && sent.length === current.length && current.every((id) => unique.has(id))
  );
}
