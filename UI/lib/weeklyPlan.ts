/* Shared weekly-plan helpers for the campaign-creation flows.
   A weekly plan is a per-channel array of 7 ints (Mon…Sun). At creation the user
   only sets each channel's Monday goal; the rest of the week is auto-filled on the
   weekdays (Mon–Fri) with weekends left at 0. It stays editable afterwards from the
   campaign Settings tab and the Weekly Goals screen. */

export interface WeeklyPlanShape {
  email: number[];
  linkedin: number[];
  calls: number[];
}

const WEEKDAYS = 5; // Mon–Fri

/** Build a Mon…Sun plan from a single Monday goal per channel: weekdays filled from
 *  the Monday value, weekends 0. */
export function buildWeekdayPlan(email: number, linkedin: number, calls: number): WeeklyPlanShape {
  const row = (v: number) =>
    Array.from({ length: 7 }, (_, i) => (i < WEEKDAYS ? Math.max(0, Math.floor(Number(v) || 0)) : 0));
  return { email: row(email), linkedin: row(linkedin), calls: row(calls) };
}
