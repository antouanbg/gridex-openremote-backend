from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo


def delivery_window_utc(day: date, timezone_name: str) -> tuple[datetime, datetime]:
    zone = ZoneInfo(timezone_name)
    start = datetime(day.year, day.month, day.day, tzinfo=zone)
    tomorrow = day + timedelta(days=1)
    end = datetime(tomorrow.year, tomorrow.month, tomorrow.day, tzinfo=zone)
    return start.astimezone(timezone.utc), end.astimezone(timezone.utc)


def expected_qh(day: date, timezone_name: str) -> int:
    start, end = delivery_window_utc(day, timezone_name)
    return int((end - start).total_seconds() // 900)
