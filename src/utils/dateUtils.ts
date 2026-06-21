import type { Calendar, CalendarMonth } from '../types';
import { STANDARD_MONTHS } from '../types';

export function getActiveMonths(calendar: Calendar): CalendarMonth[] {
  return calendar.type === 'standard' ? STANDARD_MONTHS : calendar.customMonths;
}

export function daysInYear(months: CalendarMonth[]): number {
  return months.reduce((sum, m) => sum + m.days, 0);
}

export function dateToAbsoluteDays(
  year: number,
  month: number | null,
  day: number | null,
  calendar: Calendar
): number {
  const months = getActiveMonths(calendar);
  const totalDaysPerYear = daysInYear(months);
  let days = (year - 1) * totalDaysPerYear;

  const m = month ?? 1;
  for (let i = 0; i < m - 1; i++) {
    days += months[i]?.days ?? 30;
  }
  days += (day ?? 1);
  return days;
}

export function absoluteDaysToDuration(delta: number): string {
  if (delta === 0) return '1 dia';
  const abs = Math.abs(delta);
  if (abs < 30) return `${abs} dia${abs !== 1 ? 's' : ''}`;
  if (abs < 365) {
    const m = Math.round(abs / 30);
    return `${m} mês${m !== 1 ? 'es' : ''}`;
  }
  const y = Math.floor(abs / 365);
  const rem = abs % 365;
  if (rem < 30) return `${y} ano${y !== 1 ? 's' : ''}`;
  const m = Math.round(rem / 30);
  return `${y} ano${y !== 1 ? 's' : ''} e ${m} mês${m !== 1 ? 'es' : ''}`;
}

export function formatRelativeToNow(
  eventDays: number,
  nowDays: number
): string {
  const delta = nowDays - eventDays;
  if (Math.abs(delta) < 1) return 'Hoje';
  const dur = absoluteDaysToDuration(Math.abs(delta));
  return delta > 0 ? `há ${dur}` : `em ${dur}`;
}

export function formatDuration(startDays: number, endDays: number): string {
  const delta = endDays - startDays;
  if (delta <= 0) return '1 dia';
  return absoluteDaysToDuration(delta);
}

export function formatDate(
  year: number,
  month: number | null,
  day: number | null,
  calendar: Calendar
): string {
  if (!month) return `Ano ${year}`;
  const months = getActiveMonths(calendar);
  const monthName = months[month - 1]?.name ?? `Mês ${month}`;
  if (!day) return `${monthName}, Ano ${year}`;
  return `${day} de ${monthName}, Ano ${year}`;
}

export function safeNum(val: unknown, fallback = 0): number {
  const n = Number(val);
  return isNaN(n) ? fallback : n;
}

export function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}
