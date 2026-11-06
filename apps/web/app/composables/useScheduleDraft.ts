import {
  clearScheduleDraft,
  loadScheduleDraft,
  saveScheduleDraft,
  type ScheduleDraftTarget,
  type ScheduleValues,
} from '~/utils/schedule-draft';

/**
 * Autosave of the scheduling form (issue #65): every change is kept on this device, so closing the dialog
 * or reloading the page loses nothing. Saving or cancelling the form drops the draft. The target is read on
 * each save, so a visit reloaded after a 412 keeps its draft under the new ETag.
 */
export function useScheduleDraft(target: () => ScheduleDraftTarget) {
  const saved = loadScheduleDraft(target());
  const follow = (values: () => ScheduleValues) =>
    watch(
      () => ({ ...values() }),
      (current) => saveScheduleDraft(target(), current),
      { deep: true },
    );
  const clear = () => clearScheduleDraft(target());
  /** `saved` holds the values typed before, or null when the form starts fresh. */
  return { saved, restored: saved !== null, follow, clear };
}
