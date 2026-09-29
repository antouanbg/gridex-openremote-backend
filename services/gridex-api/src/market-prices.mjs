import { XMLParser } from 'fast-xml-parser';
import { ApiError } from './errors.mjs';

// ENTSO-E bidding zones, not countries or IP-derived locations.
// https://transparencyplatform.zendesk.com/hc/en-us/articles/15885757676308
export const MARKET_ZONES = Object.freeze([
  { country: 'BG', zone: 'BG', eic: '10YCA-BULGARIA-R', timezone: 'Europe/Sofia' },
  { country: 'DE', zone: 'DE-LU', eic: '10Y1001A1001A82H', timezone: 'Europe/Berlin' },
  { country: 'ES', zone: 'ES', eic: '10YES-REE------0', timezone: 'Europe/Madrid' },
  { country: 'FR', zone: 'FR', eic: '10YFR-RTE------C', timezone: 'Europe/Paris' },
  { country: 'IT', zone: 'IT-North', eic: '10Y1001A1001A73I', timezone: 'Europe/Rome' },
  { country: 'IT', zone: 'IT-Centre-North', eic: '10Y1001A1001A70O', timezone: 'Europe/Rome' },
  { country: 'IT', zone: 'IT-Centre-South', eic: '10Y1001A1001A71M', timezone: 'Europe/Rome' },
  { country: 'IT', zone: 'IT-South', eic: '10Y1001A1001A788', timezone: 'Europe/Rome' },
  { country: 'IT', zone: 'IT-Sicily', eic: '10Y1001A1001A75E', timezone: 'Europe/Rome' },
  { country: 'IT', zone: 'IT-Sardinia', eic: '10Y1001A1001A74G', timezone: 'Europe/Rome' },
]);

const parser = new XMLParser({ ignoreAttributes: true, removeNSPrefix: true, processEntities: false });
const list = (value) => value === undefined ? [] : Array.isArray(value) ? value : [value];
const localParts = (timestamp, timezone) => Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
  timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
}).formatToParts(new Date(timestamp)).map(part => [part.type, part.value]));
const localDate = (timestamp, timezone) => {
  const parts = localParts(timestamp, timezone);
  return `${parts.year}-${parts.month}-${parts.day}`;
};

export function parseDayAheadXml(xml) {
  let document;
  try { document = parser.parse(xml); }
  catch { throw new ApiError(502, 'market_invalid_response', 'The market provider returned invalid XML.'); }
  if (Object.hasOwn(document, 'Acknowledgement_MarketDocument')) return { status: 'not_published', documentId: null, intervals: [] };
  const body = document.Publication_MarketDocument;
  if (!body) throw new ApiError(502, 'market_invalid_response', 'The market provider returned an unexpected document.');
  const intervals = [];
  for (const series of list(body.TimeSeries)) {
    if (series['contract_MarketAgreement.type'] !== 'A01'
        || series['currency_Unit.name'] !== 'EUR'
        || series['price_Measure_Unit.name'] !== 'MWH') continue;
    // Some zones publish more than one auction sequence under A44. The first
    // sequence is the canonical day-ahead product; later sequences must not
    // be mixed into it (DE-LU publishes different prices in sequence 2).
    const sequence = series['classificationSequence_AttributeInstanceComponent.position'];
    if (sequence !== undefined && Number(sequence) !== 1) continue;
    const curve = series.curveType || 'A01';
    if (!['A01', 'A03'].includes(curve)) continue;
    for (const period of list(series.Period)) {
      const start = Date.parse(period.timeInterval?.start);
      const end = Date.parse(period.timeInterval?.end);
      const resolutionMinutes = { PT15M: 15, PT60M: 60 }[period.resolution];
      if (!Number.isFinite(start) || !Number.isFinite(end) || !resolutionMinutes || end <= start)
        throw new ApiError(502, 'market_invalid_response', 'The market provider returned an invalid interval.');
      const count = (end - start) / (resolutionMinutes * 60000);
      if (!Number.isInteger(count) || count < 1 || count > 500)
        throw new ApiError(502, 'market_invalid_response', 'The market provider returned an invalid period length.');
      const values = new Map();
      for (const point of list(period.Point)) {
        const position = Number(point.position);
        const price = Number(point['price.amount']);
        if (!Number.isInteger(position) || position < 1 || position > count || !Number.isFinite(price))
          throw new ApiError(502, 'market_invalid_response', 'The market provider returned an invalid price point.');
        values.set(position, price);
      }
      let price;
      for (let index = 1; index <= count; index++) {
        if (values.has(index)) price = values.get(index);
        else if (curve !== 'A03' || price === undefined)
          throw new ApiError(502, 'market_incomplete', 'The market provider returned incomplete prices.');
        const intervalStart = start + (index - 1) * resolutionMinutes * 60000;
        intervals.push({ startUtc: new Date(intervalStart).toISOString(),
          endUtc: new Date(intervalStart + resolutionMinutes * 60000).toISOString(),
          priceEurMwh: price, resolutionMinutes });
      }
    }
  }
  if (!intervals.length) throw new ApiError(502, 'market_incomplete', 'No eligible day-ahead prices were published.');
  intervals.sort((a, b) => a.startUtc.localeCompare(b.startUtc));
  // ENTSO-E can return the same A44 series twice for one zone/day. Identical
  // points are harmless duplicates; divergent prices are never guessed away.
  const unique = [];
  for (const item of intervals) {
    const previous = unique.at(-1);
    if (previous?.startUtc === item.startUtc) {
      if (previous.endUtc !== item.endUtc || previous.priceEurMwh !== item.priceEurMwh
          || previous.resolutionMinutes !== item.resolutionMinutes)
        throw new ApiError(502, 'market_invalid_response', 'The market provider returned conflicting prices.');
      continue;
    }
    unique.push(item);
  }
  return { status: 'published', documentId: String(body.mRID || ''), intervals: unique };
}

export class DayAheadMarket {
  constructor({ token, fetcher = fetch, now = () => Date.now() }) {
    this.token = token;
    this.fetcher = fetcher;
    this.now = now;
    this.cache = new Map();
    this.pending = new Map();
  }

  async prices({ country, zone, date, service }) {
    if (service !== 'day_ahead') throw new ApiError(400, 'market_service_unsupported', 'Only day-ahead prices are currently supported.');
    const selected = MARKET_ZONES.find(item => item.country === country && item.zone === zone);
    if (!selected) throw new ApiError(400, 'market_zone_invalid', 'Select a supported country and bidding zone.');
    const day = /^\d{4}-\d{2}-\d{2}$/.test(date) ? Date.parse(`${date}T00:00:00Z`) : NaN;
    if (!Number.isFinite(day) || new Date(day).toISOString().slice(0, 10) !== date)
      throw new ApiError(400, 'market_date_invalid', 'Use a valid date in YYYY-MM-DD format.');
    if (Math.abs(day - this.now()) > 8 * 86400000)
      throw new ApiError(400, 'market_date_out_of_range', 'Choose a date within eight days of today.');
    if (!this.token) throw new ApiError(503, 'market_not_configured', 'The market provider is not configured.');
    const key = `${selected.zone}:${date}`;
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > this.now()) return cached.value;
    if (this.pending.has(key)) return this.pending.get(key);
    const job = this.#fetch(selected, date).finally(() => this.pending.delete(key));
    this.pending.set(key, job);
    return job;
  }

  async #fetch(selected, date) {
    const day = Date.parse(`${date}T00:00:00Z`);
    // Cover both sides of a local day, including 23/25-hour DST days.
    const periodStart = new Date(day - 86400000).toISOString().slice(0, 16).replace(/[-T:]/g, '');
    const periodEnd = new Date(day + 2 * 86400000).toISOString().slice(0, 16).replace(/[-T:]/g, '');
    const params = new URLSearchParams({ securityToken: this.token, documentType: 'A44',
      in_Domain: selected.eic, out_Domain: selected.eic, periodStart, periodEnd });
    let response;
    try { response = await this.fetcher(`https://web-api.tp.entsoe.eu/api?${params}`, { signal: AbortSignal.timeout(15000) }); }
    catch { throw new ApiError(503, 'market_upstream_unavailable', 'The market provider is temporarily unavailable.'); }
    if (!response.ok) throw new ApiError(503, 'market_upstream_unavailable', 'The market provider is temporarily unavailable.');
    const xml = await response.text();
    if (xml.length > 4_000_000) throw new ApiError(502, 'market_invalid_response', 'The market provider response is too large.');
    const parsed = parseDayAheadXml(xml);
    const intervals = parsed.intervals.filter(item => localDate(item.startUtc, selected.timezone) === date);
    const nextDay = new Date(day + 86400000).toISOString().slice(0, 10);
    const complete = intervals.length > 0
      && (() => { const first = localParts(intervals[0].startUtc, selected.timezone);
        const last = localParts(intervals.at(-1).endUtc, selected.timezone);
        return first.hour === '00' && first.minute === '00' && last.hour === '00' && last.minute === '00'
          && localDate(intervals.at(-1).endUtc, selected.timezone) === nextDay
          && intervals.every((item, index) => index === 0 || item.startUtc === intervals[index - 1].endUtc); })();
    const value = { provider: 'ENTSO-E Transparency Platform', sourceDocumentId: parsed.documentId,
      service: 'day_ahead', country: selected.country, zone: selected.zone,
      timezone: selected.timezone, date, currency: 'EUR', unit: 'MWh',
      status: complete ? 'published' : intervals.length ? 'partial' : 'not_published',
      fetchedAt: new Date(this.now()).toISOString(), intervals };
    this.cache.set(`${selected.zone}:${date}`, { value, expiresAt: this.now() + (complete ? 15 : 2) * 60000 });
    return value;
  }
}
