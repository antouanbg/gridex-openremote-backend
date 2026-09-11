import psycopg

from gridex_data.market.entsoe import ParsedDocument


def upsert_a44_prices(
    dsn: str,
    zone_eic: str,
    document: ParsedDocument,
    source: str = "entsoe-a44",
) -> int:
    """Persist a parsed A44 document idempotently without retaining a token."""
    rows = [
        (
            point.start_utc,
            zone_eic,
            source,
            point.resolution_min,
            point.price_eur_mwh,
            document.document_mrid or None,
        )
        for point in document.points
    ]
    if not rows:
        return 0
    with psycopg.connect(dsn) as connection, connection.cursor() as cursor:
        cursor.executemany(
            """
            INSERT INTO dam_price (
              delivery_start, zone_eic, source, resolution_min, price_eur_mwh, document_mrid
            ) VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (delivery_start, zone_eic, source) DO UPDATE SET
              resolution_min = EXCLUDED.resolution_min,
              price_eur_mwh = EXCLUDED.price_eur_mwh,
              document_mrid = EXCLUDED.document_mrid,
              fetched_at = now()
            """,
            rows,
        )
    return len(rows)
