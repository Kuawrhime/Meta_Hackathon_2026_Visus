import type { WordStatus } from '../types';
// VISUS spaced-repetition schedule — original interval table.
// Learning steps grow with the grade; Known/Ignored leave the queue.
const DAY = 86_400_000;
export const REVIEW_INTERVAL_MS: Partial<Record<WordStatus, number>> = {
  new: 0, l1: 1 * DAY, l2: 3 * DAY, l3: 7 * DAY, l4: 21 * DAY,
};
export function nextReviewDue(status: WordStatus, now = Date.now()): number | undefined {
  if (status === 'known' || status === 'ignored') return undefined;
  return now + (REVIEW_INTERVAL_MS[status] ?? 0);
}
export const isDue = (reviewDue: number | undefined, now = Date.now()) => reviewDue == null || reviewDue <= now;
