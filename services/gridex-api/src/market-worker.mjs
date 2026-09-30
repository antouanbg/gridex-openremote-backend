import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.mjs';
import { DayAheadMarket } from './market-prices.mjs';
import { MarketStorage } from './market-storage.mjs';

const config = loadConfig();
if (!config.entsoeSecurityToken || !config.marketDatabase?.password)
  throw new Error('Market token and separate TimescaleDB configuration are required');
const storage = new MarketStorage(config.marketDatabase);
const market = new DayAheadMarket({ token: config.entsoeSecurityToken });
const schema = await readFile(fileURLToPath(new URL('../market-schema.sql', import.meta.url)), 'utf8');
await storage.pool.query(schema);
let stopped = false;
let busy = false;
const checkedCurrentDay = new Map();

async function refresh() {
  if (busy || stopped) return;
  busy = true;
  try {
    for (const selected of await storage.enabledZones()) {
      if (stopped) break;
      try {
        const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
          timeZone:selected.timezone,year:'numeric',month:'2-digit',day:'2-digit',
        }).formatToParts(new Date()).map(part => [part.type,part.value]));
        const today = `${parts.year}-${parts.month}-${parts.day}`;
        const tomorrow = new Date(Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day)+1))
          .toISOString().slice(0,10);
        // One current-day check after each start/local midnight recovers from a
        // previous outage and backfills native 15-minute intervals. The next
        // delivery day is checked hourly until the daily auction is complete.
        for (const date of checkedCurrentDay.get(selected.zone) === today ? [tomorrow] : [today,tomorrow]) {
          try {
            const result = await market.prices({ country:selected.country, zone:selected.zone,
              date, service:'day_ahead' });
            const count = await storage.save(result);
            if (date === today && result.status === 'published') checkedCurrentDay.set(selected.zone,today);
            console.log(JSON.stringify({ event:'market_refresh', zone:selected.zone, deliveryDate:date,
              status:result.status, sourceIntervals:result.intervals.length,
              sourceResolutionMinutes:[...new Set(result.intervals.map(item=>item.resolutionMinutes))],
              hourlyPricesStored:count, fetchedAt:result.fetchedAt }));
          } catch (error) {
            await storage.recordError(selected.zone, selected.country, error?.code);
            console.error(JSON.stringify({ event:'market_refresh_failed', zone:selected.zone,
              deliveryDate:date, code:error?.code || 'market_unavailable' }));
          }
        }
      } catch (error) {
        await storage.recordError(selected.zone, selected.country, error?.code);
        console.error(JSON.stringify({ event:'market_refresh_failed', zone:selected.zone,
          code:error?.code || 'market_unavailable' }));
      }
    }
  } finally { busy = false; }
}

await refresh();
const timer = setInterval(refresh, 60*60*1000);
async function shutdown() { stopped = true; clearInterval(timer); await storage.close(); }
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
