/** Pickup time choices shared by the new-pickup form and "Request Again". */
export const DATE_CHOICES = [1, 2, 3] as const;
export const TIME_CHOICES = [
  { id: 'morning', label: 'Morning (9am - 12pm)', startHour: 9, endHour: 12 },
  { id: 'afternoon', label: 'Afternoon (1pm - 4pm)', startHour: 13, endHour: 16 },
] as const;

export type DayChoice = (typeof DATE_CHOICES)[number];
export type TimeChoice = (typeof TIME_CHOICES)[number]['id'];

export function dayLabel(days: number): string {
  return days === 1 ? 'Tomorrow' : `In ${days} days`;
}

/** The pickup window for a day offset and time choice, in the phone's local time, as ISO strings. */
export function buildPickupWindow(day: number, time: TimeChoice, now: Date = new Date()) {
  const choice = TIME_CHOICES.find((item) => item.id === time) ?? TIME_CHOICES[0];
  const start = new Date(now);
  start.setDate(start.getDate() + day);
  start.setHours(choice.startHour, 0, 0, 0);
  const end = new Date(start);
  end.setHours(choice.endHour, 0, 0, 0);
  return { start: start.toISOString(), end: end.toISOString(), choice };
}

/** True when a pickup window has not started yet (so it can be reused as is). */
export function windowStillAhead(windowStart: string | null | undefined, now: Date = new Date()): boolean {
  return !!windowStart && new Date(windowStart).getTime() > now.getTime();
}
