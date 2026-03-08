import { startOfWeek, addDays, format } from 'date-fns';

export const TIMEZONE_OPTIONS = [
  { value: 'America/New_York', label: 'Eastern (ET)', short: 'ET' },
  { value: 'America/Chicago', label: 'Central (CT)', short: 'CT' },
  { value: 'America/Denver', label: 'Mountain (MT)', short: 'MT' },
  { value: 'America/Los_Angeles', label: 'Pacific (PT)', short: 'PT' },
  { value: 'America/Anchorage', label: 'Alaska (AKT)', short: 'AKT' },
  { value: 'Pacific/Honolulu', label: 'Hawaii (HT)', short: 'HT' },
  { value: 'Europe/London', label: 'London (GMT/BST)', short: 'GMT' },
  { value: 'Europe/Paris', label: 'Paris (CET)', short: 'CET' },
  { value: 'Europe/Berlin', label: 'Berlin (CET)', short: 'CET' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)', short: 'JST' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)', short: 'CST' },
  { value: 'Asia/Kolkata', label: 'India (IST)', short: 'IST' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)', short: 'GST' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)', short: 'AEST' },
  { value: 'Pacific/Auckland', label: 'Auckland (NZST)', short: 'NZST' },
];

export function getTimezoneShort(tz: string): string {
  const found = TIMEZONE_OPTIONS.find(t => t.value === tz);
  return found?.short ?? tz.split('/').pop()?.replace('_', ' ') ?? tz;
}

export function convertHour(hour: number, fromTz: string, toTz: string, referenceDate?: Date): string {
  const date = referenceDate ?? new Date();
  const wholeHour = Math.floor(hour);
  const minutes = Math.round((hour - wholeHour) * 60);
  const utcDate = getUTCFromTimezone(wholeHour, minutes, fromTz, date);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: toTz,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return formatter.format(utcDate);
}

function getUTCFromTimezone(hour: number, minutes: number, tz: string, refDate: Date): Date {
  const dateStr = refDate.toLocaleDateString('en-CA');
  const utcGuess = new Date(`${dateStr}T${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00Z`);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(utcGuess);
  const shownHour = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0');
  const shownMin = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0');
  const diffMs = ((shownHour * 60 + shownMin) - (hour * 60 + minutes)) * 60000;
  return new Date(utcGuess.getTime() - diffMs);
}

export function getWeekDates(date: Date): Date[] {
  const monday = startOfWeek(date, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function toDateString(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function formatHour(hour: number): string {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export const CLIENT_COLORS = [
  '#FBBF24', '#F472B6', '#60A5FA', '#34D399', '#A78BFA',
  '#FB923C', '#F87171', '#2DD4BF', '#E879F9', '#818CF8',
];
