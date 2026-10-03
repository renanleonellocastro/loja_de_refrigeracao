/** Up to two uppercase initials from a name: "Eduardo Castro" becomes "EC". */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0];
  if (first === undefined) return '?';
  const last = words.length > 1 ? words[words.length - 1]!.charAt(0) : '';
  return (first.charAt(0) + last).toUpperCase();
}
