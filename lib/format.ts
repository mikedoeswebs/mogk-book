export function formatPence(pence: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(pence / 100);
}

export function formatDate(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Long date, no weekday: "1 June 2026". */
export function formatDateLong(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatTime(time: string): string {
  return time.slice(0, 5);
}

/** Date of birth: e.g. "1 Jan 2012". No weekday. */
export function formatDob(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Whole years between a date of birth and today, e.g. 6. */
export function ageFromDob(date: string): number {
  const b = new Date(date + 'T00:00:00');
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

export function formatDateTime(dateStr: string, timeStr: string): string {
  return `${formatDate(dateStr)} ${formatTime(timeStr)}`;
}
