export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isSameUtcCalendarDay(a: Date, b: Date): boolean {
  return toIsoDate(a) === toIsoDate(b);
}

export function isFutureDate(isoDate: string): boolean {
  return isoDate > toIsoDate(new Date());
}

export function thirtyDaysAgo(): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 30);
  return date;
}
