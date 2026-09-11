import unittest
from datetime import UTC, datetime

import httpx

from gridex_data.cli import build_parser
from gridex_data.market.entsoe import (
    DayAheadPriceRequest,
    EntsoeClient,
    EntsoeRequestError,
)


XML = """<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<Publication_MarketDocument xmlns=\"urn:iec62325.351:tc57wg16:451-3:publicationdocument:7:3\">
  <mRID>document-1</mRID>
  <TimeSeries>
    <contract_MarketAgreement.type>A01</contract_MarketAgreement.type>
    <currency_Unit.name>EUR</currency_Unit.name>
    <price_Measure_Unit.name>MWH</price_Measure_Unit.name>
    <curveType>A01</curveType>
    <Period>
      <timeInterval><start>2026-09-12T00:00Z</start></timeInterval>
      <resolution>PT60M</resolution>
      <Point><position>1</position><price.amount>100.50</price.amount></Point>
    </Period>
  </TimeSeries>
</Publication_MarketDocument>"""


class EntsoeClientTest(unittest.IsolatedAsyncioTestCase):
    def request(self) -> DayAheadPriceRequest:
        return DayAheadPriceRequest(
            "10YTEST----------X",
            datetime(2026, 9, 12, tzinfo=UTC),
            datetime(2026, 9, 13, tzinfo=UTC),
        )

    async def test_fetch_a44_uses_zone_and_returns_quarter_hour_points(self) -> None:
        seen: dict[str, str] = {}

        def handler(request: httpx.Request) -> httpx.Response:
            seen.update(dict(request.url.params))
            return httpx.Response(200, text=XML)

        client = EntsoeClient("test-token", transport=httpx.MockTransport(handler))
        document = await client.fetch_a44(self.request())

        self.assertEqual("A44", seen["documentType"])
        self.assertEqual("10YTEST----------X", seen["in_Domain"])
        self.assertEqual("10YTEST----------X", seen["out_Domain"])
        self.assertEqual("202609120000", seen["periodStart"])
        self.assertEqual(4, len(document.points))
        self.assertEqual("100.50", str(document.points[0].price_eur_mwh))

    async def test_http_failure_does_not_echo_the_security_token(self) -> None:
        client = EntsoeClient(
            "secret-value-not-to-log",
            transport=httpx.MockTransport(lambda request: httpx.Response(401)),
        )
        with self.assertRaises(EntsoeRequestError) as raised:
            await client.fetch_a44(self.request())
        self.assertEqual("ENTSO-E returned HTTP 401", str(raised.exception))


class CliParserTest(unittest.TestCase):
    def test_market_a44_command_parses(self) -> None:
        args = build_parser().parse_args(
            ["market", "fetch-a44", "--zone-eic", "10YTEST----------X"]
        )
        self.assertEqual("market", args.command)
        self.assertEqual("fetch-a44", args.market_command)
        self.assertEqual("10YTEST----------X", args.zone_eic)
