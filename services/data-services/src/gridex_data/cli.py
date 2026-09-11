import argparse
import asyncio
from datetime import UTC, datetime, timedelta

from gridex_data.config import Settings
from gridex_data.market.entsoe import DayAheadPriceRequest, EntsoeClient
from gridex_data.market.storage import upsert_a44_prices


def _utc_timestamp(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise argparse.ArgumentTypeError("timestamp must include a timezone, e.g. 2026-09-12T00:00:00Z")
    return parsed.astimezone(UTC)


async def _fetch_a44(settings: Settings, args: argparse.Namespace) -> int:
    token = settings.resolved_entsoe_token()
    if not token:
        raise SystemExit("ENTSO-E token unavailable: configure the Docker secret file or local ENTSOE_TOKEN")
    start = args.period_start or datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
    end = args.period_end or start + timedelta(days=2)
    document = await EntsoeClient(token, settings.entsoe_base_url).fetch_a44(
        DayAheadPriceRequest(args.zone_eic, start, end)
    )
    if settings.data_db_dsn:
        count = upsert_a44_prices(settings.data_db_dsn, args.zone_eic, document)
        print(f"stored {count} A44 price points for {args.zone_eic}")
    else:
        print(f"fetched {len(document.points)} A44 price points for {args.zone_eic}; DATA_DB_DSN is not configured")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="gridex-data")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("run", help="Run discovery, ENTSO-E and Open-Meteo workers.")
    sub.add_parser("discover", help="List enabled OpenRemote asset jobs.")
    sub.add_parser("status", help="Check data service readiness.")
    market = sub.add_parser("market", help="Market operations (fetch, backfill, verify).")
    market_sub = market.add_subparsers(dest="market_command", required=True)
    a44 = market_sub.add_parser("fetch-a44", help="Fetch ENTSO-E A44 day-ahead prices.")
    a44.add_argument("--zone-eic", required=True, help="Bidding-zone EIC from the supplier asset.")
    a44.add_argument("--period-start", type=_utc_timestamp, help="UTC ISO-8601 start; defaults to today.")
    a44.add_argument("--period-end", type=_utc_timestamp, help="UTC ISO-8601 end; defaults to start + 2 days.")
    sub.add_parser("forecast", help="Forecast operations (fetch, run-once).")
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    settings = Settings()
    if args.command == "status":
        raise SystemExit(0 if settings.data_db_dsn and settings.or_url else 2)
    if args.command == "market" and args.market_command == "fetch-a44":
        raise SystemExit(asyncio.run(_fetch_a44(settings, args)))
    print(f"{args.command}: service skeleton installed; configure OpenRemote asset attributes first")
