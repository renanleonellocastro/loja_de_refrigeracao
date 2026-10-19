/** Body of an action whose reason is optional: blank text sends no reason at all. */
export function optionalReason(text: string): { reason?: string } {
  const reason = text.trim();
  return reason ? { reason } : {};
}
