from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal
from xml.etree import ElementTree as ET


class ParseError(ValueError):
    pass


@dataclass(frozen=True)
class PricePoint:
    start_utc: datetime
    price_eur_mwh: Decimal
    resolution_min: int


@dataclass(frozen=True)
class ParsedDocument:
    document_mrid: str
    points: list[PricePoint]


def _name(node: ET.Element) -> str:
    return node.tag.rsplit("}", 1)[-1]


def _find(node: ET.Element, name: str) -> ET.Element | None:
    return next((item for item in node.iter() if _name(item) == name), None)


def _text(node: ET.Element, name: str) -> str | None:
    found = _find(node, name)
    return found.text if found is not None else None


def parse_a44(xml: str) -> ParsedDocument:
    root = ET.fromstring(xml)
    if _name(root) == "Acknowledgement_MarketDocument":
        raise ParseError("NotPublishedYet")
    mrid = _text(root, "mRID") or ""
    output: list[PricePoint] = []
    for series in (item for item in root.iter() if _name(item) == "TimeSeries"):
        if _text(series, "contract_MarketAgreement.type") != "A01":
            continue
        if _text(series, "currency_Unit.name") != "EUR" or _text(series, "price_Measure_Unit.name") != "MWH":
            continue
        curve = _text(series, "curveType") or "A01"
        periods = [item for item in series.iter() if _name(item) == "Period"]
        for period in periods:
            interval = _find(period, "timeInterval")
            if interval is None:
                raise ParseError("missing interval")
            start_text = _text(interval, "start")
            if not start_text:
                raise ParseError("missing start")
            start = datetime.fromisoformat(start_text.replace("Z", "+00:00"))
            resolution = _text(period, "resolution")
            minutes = {"PT15M": 15, "PT60M": 60}.get(resolution or "")
            if minutes is None:
                continue
            values: dict[int, Decimal] = {}
            for point in (item for item in period if _name(item) == "Point"):
                position, price = _text(point, "position"), _text(point, "price.amount")
                if position and price:
                    values[int(position)] = Decimal(price)
            if not values:
                continue
            last: Decimal | None = None
            for position in range(1, max(values) + 1):
                if position in values:
                    last = values[position]
                elif curve != "A03" or last is None:
                    raise ParseError(f"missing A01 point {position}")
                assert last is not None
                point_start = start + timedelta(minutes=(position - 1) * minutes)
                if minutes == 60:
                    output.extend(PricePoint(point_start + timedelta(minutes=15 * quarter), last, 60) for quarter in range(4))
                else:
                    output.append(PricePoint(point_start, last, 15))
    if not output:
        raise ParseError("no eligible A44 series")
    return ParsedDocument(mrid, sorted(output, key=lambda point: point.start_utc))
