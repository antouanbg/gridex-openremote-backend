import { ApiError } from './errors.mjs';

const fixedRanges = Object.freeze({
  delivery: { from: 'now-24h', to: 'now+36h' },
  recent: { from: 'now-48h', to: 'now' },
  week: { from: 'now-7d', to: 'now' },
  month: { from: 'now-30d', to: 'now' },
});
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const sofiaOffset = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Sofia', timeZoneName: 'shortOffset',
});

function dayUtc(day) {
  if (!datePattern.test(day)) throw new ApiError(400, 'grafana_range_invalid', 'Select valid calendar dates.');
  const [year, month, date] = day.split('-').map(Number);
  const midnight = Date.UTC(year, month - 1, date);
  if (new Date(midnight).toISOString().slice(0, 10) !== day)
    throw new ApiError(400, 'grafana_range_invalid', 'Select valid calendar dates.');
  const label = sofiaOffset.formatToParts(new Date(midnight)).find(part => part.type === 'timeZoneName')?.value;
  const match = /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(label || '');
  if (!match) throw new ApiError(500, 'grafana_range_unavailable', 'Bulgaria time is unavailable.');
  const offset = (Number(match[2]) * 60 + Number(match[3] || 0)) * 60000 * (match[1] === '+' ? 1 : -1);
  return midnight - offset;
}

export function grafanaTimeRange(params) {
  const range = params.get('range') || 'delivery';
  if (Object.hasOwn(fixedRanges, range)) return fixedRanges[range];
  if (range !== 'custom') throw new ApiError(400, 'grafana_range_invalid', 'Select a supported period.');
  const fromDay = params.get('fromDay') || '';
  const toDay = params.get('toDay') || '';
  const from = dayUtc(fromDay);
  dayUtc(toDay);
  const calendarEnd = new Date(Date.parse(`${toDay}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
  const to = dayUtc(calendarEnd);
  const calendarDays = (Date.parse(`${toDay}T00:00:00Z`) - Date.parse(`${fromDay}T00:00:00Z`)) / 86400000;
  if (calendarDays < 0 || calendarDays > 30)
    throw new ApiError(400, 'grafana_range_invalid', 'Select up to 31 delivery days in order.');
  return { from: String(from), to: String(to) };
}
