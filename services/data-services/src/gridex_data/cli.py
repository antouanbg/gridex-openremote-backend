import argparse

from gridex_data.config import Settings


def main() -> None:
    parser = argparse.ArgumentParser(prog="gridex-data")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("run", help="Run discovery, ENTSO-E and Open-Meteo workers.")
    sub.add_parser("discover", help="List enabled OpenRemote asset jobs.")
    sub.add_parser("status", help="Check data service readiness.")
    parser.add_parser("market", help="Market operations (fetch, backfill, verify).")
    parser.add_parser("forecast", help="Forecast operations (fetch, run-once).")
    args = parser.parse_args()
    settings = Settings()
    if args.command == "status":
        raise SystemExit(0 if settings.data_db_dsn and settings.or_url else 2)
    print(f"{args.command}: service skeleton installed; configure OpenRemote asset attributes first")
